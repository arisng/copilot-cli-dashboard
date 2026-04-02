import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../hooks/useSession.ts';
import { useSessions } from '../../hooks/useSessions.ts';
import {
  DEFAULT_SESSION_BROWSE_STATE,
  SESSION_BROWSE_SORT_FIELDS,
  SESSION_BROWSE_STATUS_OPTIONS,
  getProjectLabel,
  normalizeProjectPathForComparison,
  paginateSessionsForBrowse,
  type SessionBrowseSortField,
  type SessionBrowseStatus,
  useSessionBrowse,
} from '../../hooks/useSessionBrowse.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import {
  BrowsePagination,
  BrowseSelect,
  BrowseSortOrderToggle,
  SESSION_BROWSE_SORT_FIELD_LABELS,
} from '../shared/SessionBrowseControls.tsx';
import { SessionMeta } from './SessionMeta.tsx';
import { SessionTabNav, getSessionDetailPanelId, getSessionDetailTabId, type SessionDetailTab } from './SessionTabNav.tsx';
import { modeBorderClass } from '../shared/modeBadge.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { RelativeTime } from '../shared/RelativeTime.tsx';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import type {
  ActiveSubAgent,
  ParsedMessage,
  SessionArtifactEntry,
  SessionArtifactGroup,
  SessionArtifacts,
  SessionDbInspection,
  SessionDetail as SessionDetailData,
  SessionSummary,
  TodoItem,
} from '../../api/client.ts';
import { isImageFile } from '../../utils/fileUtils.ts';
import { ImagePreview } from './ImagePreview.tsx';
import { fetchSessionArtifacts, fetchSessionDb } from '../../api/client.ts';
import { sortTodosLatestFirst } from '../../utils/todoSort.ts';

// ── Shared markdown renderer imported from ../shared/MarkdownRenderer ─────

type SessionDetailView = 'main' | 'plan' | 'todos' | 'threads' | 'checkpoints' | 'research' | 'files' | 'session-db';
type SessionDbViewMode = 'graph' | 'table';

const DETAIL_VIEW_OPTIONS: Array<{ value: SessionDetailView; label: string }> = [
  { value: 'main', label: 'Main session' },
  { value: 'plan', label: 'Plan' },
  { value: 'todos', label: 'Todos' },
  { value: 'threads', label: 'Sub-agent threads' },
  { value: 'checkpoints', label: 'Checkpoints' },
  { value: 'research', label: 'Research' },
  { value: 'files', label: 'Files' },
  { value: 'session-db', label: 'Session DB' },
];

const DETAIL_VIEW_DESCRIPTIONS: Partial<Record<SessionDetailView, string>> = {
  main: 'Primary conversation stream for the session.',
  plan: 'Captured plan content and execution guardrails.',
  todos: 'Work items with dependency and status tracking.',
  threads: 'Sub-agent conversations with grouped selection.',
  checkpoints: 'Captured checkpoint files and snapshots.',
  research: 'Research notes, references, and supporting files.',
  files: 'Additional files and documents from the session.',
  'session-db': 'Todo dependency graph with a table preview fallback.',
};

const DEFAULT_DB_PREVIEW_LIMIT = 50;
const DEFAULT_DB_GRAPH_LIMIT = 500;

function truncateText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatBytes(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = sizeBytes;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return truncateText(value, 240) || '—';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== '{}' ? truncateText(serialized, 240) : '—';
  } catch {
    return truncateText(String(value), 240);
  }
}

function rowMatchesFilter(row: Record<string, unknown>, filterValue: string): boolean {
  const trimmed = filterValue.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex > 0) {
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      return Object.entries(row).some(([columnName, columnValue]) =>
        columnName.toLowerCase().includes(trimmed) || formatPreviewValue(columnValue).toLowerCase().includes(trimmed)
      );
    }

    const matchingEntry = Object.entries(row).find(([columnName]) => columnName.toLowerCase() === key);
    return matchingEntry ? formatPreviewValue(matchingEntry[1]).toLowerCase().includes(value) : false;
  }

  return Object.entries(row).some(([columnName, columnValue]) =>
    columnName.toLowerCase().includes(trimmed) || formatPreviewValue(columnValue).toLowerCase().includes(trimmed)
  );
}

function getRowString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }

  return '';
}

function getArtifactGroupByPath(artifacts: SessionArtifacts | null, path: SessionArtifactGroup['path']): SessionArtifactGroup | null {
  if (!artifacts) {
    return null;
  }

  if (path === 'plan.md') {
    return artifacts.plan;
  }

  return artifacts.folders.find((group) => group.path === path) ?? null;
}

function collectArtifactFiles(entries: SessionArtifactEntry[]): SessionArtifactEntry[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'file') {
      return [entry];
    }

    return collectArtifactFiles(entry.children ?? []);
  });
}

function renderArtifactContent(
  entry: SessionArtifactEntry,
  sessionId: string,
  forceMarkdown = false,
) {
  // Handle image files
  if (isImageFile(entry.name)) {
    return (
      <ImagePreview
        sessionId={sessionId}
        filePath={entry.path}
        fileName={entry.name}
        fileSizeBytes={entry.sizeBytes}
      />
    );
  }

  // Handle text files
  const content = entry.content?.trim();
  if (!content) {
    return (
      <p className="rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
        No text content is available for this file.
      </p>
    );
  }

  if (forceMarkdown || /\.(md|markdown|mdown|mkdn|mkd)$/i.test(entry.name)) {
    return <MarkdownRenderer content={content} variant="desktop" />;
  }

  // For non-markdown files, still use MarkdownRenderer but with plain text handling
  return <MarkdownRenderer content={content} variant="desktop" />;
}

function buildTodoItemsFromDb(
  todoInspection: SessionDbInspection | null,
  todoDepsInspection: SessionDbInspection | null,
  fallbackTodos: TodoItem[] = [],
): TodoItem[] {
  if (!todoInspection?.table.rows.length) {
    return fallbackTodos;
  }

  const dependencyByTodoId = new Map<string, string[]>();
  (todoDepsInspection?.table.rows ?? []).forEach((row) => {
    const todoId = getRowString(row, ['todo_id', 'todoId']);
    const dependsOn = getRowString(row, ['depends_on', 'dependsOn']);
    if (!todoId || !dependsOn) {
      return;
    }

    const existing = dependencyByTodoId.get(todoId) ?? [];
    existing.push(dependsOn);
    dependencyByTodoId.set(todoId, existing);
  });

  return todoInspection.table.rows.map((row) => {
    const id = getRowString(row, ['id']);
    return {
      id,
      title: getRowString(row, ['title']) || id,
      description: getRowString(row, ['description']),
      status: getRowString(row, ['status']) || 'pending',
      createdAt: getRowString(row, ['created_at', 'createdAt']),
      updatedAt: getRowString(row, ['updated_at', 'updatedAt']),
      dependsOn: id ? dependencyByTodoId.get(id) ?? [] : [],
    };
  }).filter((todo) => Boolean(todo.id));
}

function getArtifactGroupLabel(group: SessionArtifactGroup) {
  if (group.path === 'plan.md') {
    return 'Plan';
  }

  return group.path.charAt(0).toUpperCase() + group.path.slice(1);
}

function getArtifactGroupDescription(group: SessionArtifactGroup) {
  if (!group.exists) {
    return group.message ?? 'Not found in session-state.';
  }

  if (group.status === 'unreadable') {
    return group.message ?? 'Read-only access failed.';
  }

  if (group.path === 'plan.md' && group.content) {
    return truncateText(group.content, 220);
  }

  const entryCount = group.entries?.length ?? 0;
  if (entryCount > 0) {
    return `${entryCount} item${entryCount === 1 ? '' : 's'} available.`;
  }

  return 'No files recorded.';
}

function useSessionArtifacts(sessionId: string) {
  const [artifacts, setArtifacts] = useState<SessionArtifacts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setArtifacts(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSessionArtifacts(sessionId)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setArtifacts(data);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setArtifacts(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load artifacts');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { artifacts, loading, error };
}

function useSessionDbInspection(sessionId: string, table: string, limit: number) {
  const [inspection, setInspection] = useState<SessionDbInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setInspection(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSessionDb(sessionId, table || undefined, limit)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setInspection(data);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        setInspection(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load session database');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, table, limit]);

  return { inspection, loading, error };
}

// ── Plan view ──────────────────────────────────────────────────────────────

function PlanView({ content, isPending }: { content: string; isPending: boolean }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {isPending && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gh-attention/30 bg-gh-attention/10 text-gh-attention text-sm">
          <span className="w-2 h-2 rounded-full bg-gh-attention animate-pulse shrink-0" />
          <span className="font-medium">Waiting for your approval</span>
          <span className="text-gh-attention/70 text-xs">· Review the plan below and approve or reject it in your terminal</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">
        <MarkdownRenderer content={content} variant="desktop" />
      </div>
    </div>
  );
}

// ── Todos view ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  completed:   { label: 'Done',        dot: 'bg-gh-active',              text: 'text-gh-active' },
  done:        { label: 'Done',        dot: 'bg-gh-active',              text: 'text-gh-active' },
  in_progress: { label: 'In progress', dot: 'bg-gh-accent animate-pulse', text: 'text-gh-accent' },
  pending:     { label: 'Pending',     dot: 'bg-gh-muted',               text: 'text-gh-muted' },
  cancelled:   { label: 'Cancelled',   dot: 'bg-gh-attention',           text: 'text-gh-attention' },
  blocked:     { label: 'Blocked',     dot: 'bg-gh-attention',           text: 'text-gh-attention' },
};

function isDone(status: string) {
  return status === 'done' || status === 'completed' || status === 'cancelled';
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function TodosView({ todos }: { todos: TodoItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const sortedTodos = sortTodosLatestFirst(todos);
  const pending   = sortedTodos.filter((t) => t.status === 'pending');
  const active    = sortedTodos.filter((t) => t.status === 'in_progress');
  const blocked   = sortedTodos.filter((t) => t.status === 'blocked');
  const done      = sortedTodos.filter((t) => isDone(t.status));
  const groups = [
    { label: 'In progress', items: active,  accent: 'text-gh-accent' },
    { label: 'Blocked',     items: blocked, accent: 'text-gh-attention' },
    { label: 'Pending',     items: pending, accent: 'text-gh-muted' },
    { label: 'Done',        items: done,    accent: 'text-gh-muted' },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${group.accent}`}>
            {group.label} · {group.items.length}
          </p>
          <div className="space-y-1.5">
            {group.items.map((todo) => {
              const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.pending;
              const isExpanded = expanded.has(todo.id);
              return (
                <div
                  key={todo.id}
                  className="rounded-lg border border-gh-border bg-gh-surface/30 overflow-hidden"
                >
                  <button
                    onClick={() => toggle(todo.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gh-surface/60 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-sm text-gh-text font-medium flex-1 leading-snug">{todo.title}</span>
                    {todo.dependsOn.length > 0 && (
                      <span className="text-xs text-gh-muted shrink-0">{todo.dependsOn.length} dep{todo.dependsOn.length !== 1 ? 's' : ''}</span>
                    )}
                    <svg
                      viewBox="0 0 16 16" width="10" height="10" fill="currentColor"
                      className={`text-gh-muted shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gh-border/50 pt-2 space-y-2">
                      <p className="text-xs text-gh-muted leading-relaxed">{todo.description}</p>
                      {todo.dependsOn.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gh-muted">Depends on:</span>
                          {todo.dependsOn.map((dep) => (
                            <span key={dep} className="text-xs font-mono bg-gh-bg border border-gh-border rounded px-1.5 py-0.5 text-gh-muted">{dep}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <p className="text-center text-gh-muted text-sm py-8">No todos yet.</p>
      )}
    </div>
  );
}

// ── Message list ───────────────────────────────────────────────────────────

function MessageList({ messages }: { messages: ParsedMessage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return <div className="p-8 text-center text-gh-muted text-sm">No messages yet.</div>;
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
    </div>
  );
}

function DetailPanelHeader({
  session,
  activeView,
  activeThread,
  dbViewMode,
  selectedDbTable,
  artifacts,
  showSessionSidebar,
  onToggleSessionSidebar,
}: {
  session: SessionDetailData;
  activeView: SessionDetailView;
  activeThread: ActiveSubAgent | null;
  dbViewMode: SessionDbViewMode;
  selectedDbTable: string;
  artifacts: SessionArtifacts | null;
  showSessionSidebar: boolean;
  onToggleSessionSidebar: () => void;
}) {
  const todos = session.todos ?? [];
  const activeTodos = todos.filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = todos.filter((todo) => todo.status === 'blocked').length;
  const completedTodos = todos.filter((todo) => isDone(todo.status)).length;
  const checkpointGroup = getArtifactGroupByPath(artifacts, 'checkpoints');
  const researchGroup = getArtifactGroupByPath(artifacts, 'research');
  const filesGroup = getArtifactGroupByPath(artifacts, 'files');
  const checkpointFileCount = checkpointGroup ? collectArtifactFiles(checkpointGroup.entries ?? []).length : 0;
  const researchFileCount = researchGroup ? collectArtifactFiles(researchGroup.entries ?? []).length : 0;
  const filesFileCount = filesGroup ? collectArtifactFiles(filesGroup.entries ?? []).length : 0;

  const titleByView: Record<SessionDetailView, string> = {
    main: 'Main session',
    plan: 'Plan',
    todos: 'Todos',
    threads: 'Sub-agent threads',
    checkpoints: 'Checkpoints',
    research: 'Research',
    files: 'Files',
    'session-db': dbViewMode === 'graph' ? 'Todo dependency graph' : 'Session DB table preview',
  };

  const descriptionByView: Partial<Record<SessionDetailView, string>> = {
    main: `${pluralize(session.messageCount, 'message')} in the primary conversation.`,
    plan: session.isPlanPending
      ? 'Review the captured plan before execution continues.'
      : 'Captured plan content available for reference.',
    todos: todos.length > 0
      ? `${pluralize(activeTodos, 'active todo')} · ${pluralize(blockedTodos, 'blocked todo')} · ${completedTodos}/${todos.length} done`
      : 'No todos are recorded for this session yet.',
    threads: activeThread
      ? activeThread.description || activeThread.agentDisplayName || activeThread.agentName
      : 'Sub-agent conversations grouped for quicker scanning.',
    checkpoints: checkpointGroup?.status === 'ok'
      ? `${checkpointFileCount} checkpoint file${checkpointFileCount === 1 ? '' : 's'} available.`
      : 'Checkpoint artifacts from the current session.',
    research: researchGroup?.status === 'ok'
      ? `${researchFileCount} research file${researchFileCount === 1 ? '' : 's'} available.`
      : 'Research artifacts from the current session.',
    files: filesGroup?.status === 'ok'
      ? `${filesFileCount} file${filesFileCount === 1 ? '' : 's'} available.`
      : 'Additional files from the current session.',
    'session-db': dbViewMode === 'graph'
      ? 'Read-only todo dependency graph with a table preview fallback.'
      : 'Read-only schema and row preview for the session database.',
  };

  const badgeTextByView: Partial<Record<SessionDetailView, string>> = {
    main: session.isWorking ? 'Live' : session.isOpen ? 'Open' : 'Closed',
    plan: session.isPlanPending ? 'Needs review' : 'Captured',
    todos: todos.length > 0 ? `${completedTodos}/${todos.length} done` : undefined,
    threads: activeThread ? (activeThread.isCompleted ? 'Done' : 'Running') : undefined,
    checkpoints: checkpointGroup?.status === 'ok' ? `${checkpointFileCount} files` : 'Artifacts',
    research: researchGroup?.status === 'ok' ? `${researchFileCount} files` : 'Artifacts',
    files: filesGroup?.status === 'ok' ? `${filesFileCount} files` : 'Artifacts',
    'session-db': dbViewMode === 'graph'
      ? 'Graph'
      : selectedDbTable
        ? 'Table preview'
        : 'Read only',
  };

  const badgeClassByView: Partial<Record<SessionDetailView, string>> = {
    main: session.isWorking
      ? 'border-gh-active/30 bg-gh-active/10 text-gh-active'
      : 'border-gh-border bg-gh-bg/70 text-gh-muted',
    plan: session.isPlanPending
      ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention'
      : 'border-gh-border bg-gh-bg/70 text-gh-muted',
    todos: 'border-gh-active/30 bg-gh-active/10 text-gh-active',
    threads: activeThread?.isCompleted
      ? 'border-gh-border bg-gh-bg/70 text-gh-muted'
      : 'border-gh-active/30 bg-gh-active/10 text-gh-active',
    checkpoints: 'border-gh-border bg-gh-bg/70 text-gh-muted',
    research: 'border-gh-border bg-gh-bg/70 text-gh-muted',
    files: 'border-gh-border bg-gh-bg/70 text-gh-muted',
    'session-db': 'border-gh-border bg-gh-bg/70 text-gh-muted',
  };

  return (
    <div className="shrink-0 border-b border-gh-border bg-gh-surface/40 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id="session-detail-panel-heading" className="text-sm font-semibold text-gh-text">
            {titleByView[activeView]}
          </p>
          <p className="mt-1 text-xs leading-5 text-gh-muted">{descriptionByView[activeView]}</p>
          <p className="mt-2 text-xs text-gh-muted/80">
            {activeView === 'threads' && activeThread
              ? `${activeThread.agentDisplayName || activeThread.agentName}${activeThread.description ? ` · ${activeThread.description}` : ''}`
              : activeView === 'session-db' && dbViewMode === 'table'
                ? selectedDbTable || 'Table preview'
                : session.title}
          </p>
        </div>
        {badgeTextByView[activeView] && (
          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${badgeClassByView[activeView]}`}>
            {badgeTextByView[activeView]}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleSessionSidebar}
          aria-pressed={showSessionSidebar}
          className="inline-flex items-center gap-1.5 rounded-full border border-gh-border bg-gh-bg/70 px-3 py-1 text-xs font-medium text-gh-muted transition-colors hover:border-gh-border hover:text-gh-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface"
          title={showSessionSidebar ? 'Hide session browser column' : 'Show session browser column'}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M1.75 2A1.75 1.75 0 000 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0016 12.25v-8.5A1.75 1.75 0 0014.25 2zM1.5 3.75a.25.25 0 01.25-.25H4v9H1.75a.25.25 0 01-.25-.25zm4 8.75v-9h4.5v9zm6 0v-9h2.25a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25z" />
          </svg>
          <span>{showSessionSidebar ? 'Hide sessions' : 'Show sessions'}</span>
        </button>
      </div>
    </div>
  );
}

function ArtifactEntryTree({
  entry,
  selectedPath,
  onSelectFile,
}: {
  entry: SessionArtifactEntry;
  selectedPath: string;
  onSelectFile: (path: string) => void;
}) {
  const isFolder = entry.kind === 'directory';
  const isSelected = !isFolder && entry.path === selectedPath;
  const isImage = !isFolder && isImageFile(entry.name);

  return (
    <li className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
            isFolder ? 'bg-gh-accent/12 text-gh-accent' : isSelected ? 'bg-gh-active/15 text-gh-active' : 'bg-gh-border/70 text-gh-muted'
          }`}
        >
          {isFolder ? '▸' : isImage ? '🖼' : '•'}
        </span>
        <div className="min-w-0 flex-1">
          {isFolder ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-gh-text">{entry.name}</span>
              <span className="rounded-full border border-gh-border bg-gh-surface px-2 py-0.5 text-[11px] text-gh-muted">
                folder
              </span>
              <span className="text-[11px] text-gh-muted">
                {formatBytes(entry.sizeBytes)}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectFile(entry.path)}
              className={`flex w-full flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
                isSelected
                  ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
                  : 'border-transparent bg-transparent text-gh-muted hover:border-gh-border hover:bg-gh-surface/60 hover:text-gh-text'
              }`}
            >
              <span className="truncate text-sm font-medium">{entry.name}</span>
              <span className={`rounded-full border border-gh-border bg-gh-surface px-2 py-0.5 text-[11px] ${isImage ? 'text-gh-accent' : 'text-gh-muted'}`}>
                {isImage ? 'image' : 'file'}
              </span>
              <span className="text-[11px] text-gh-muted">
                {formatBytes(entry.sizeBytes)}
              </span>
            </button>
          )}
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gh-muted">
            <span className="font-mono">{entry.path}</span>
            <span>·</span>
            <span>{new Date(entry.modifiedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {entry.children && entry.children.length > 0 && (
        <ul className="mt-2 space-y-2 pl-2">
          {entry.children.map((child) => (
            <ArtifactEntryTree
              key={`${entry.path}/${child.name}`}
              entry={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ArtifactGroupPanel({ group, sessionId }: { group: SessionArtifactGroup; sessionId: string }) {
  const files = useMemo(() => collectArtifactFiles(group.entries ?? []), [group.entries]);
  const [selectedPath, setSelectedPath] = useState(files[0]?.path ?? '');

  useEffect(() => {
    if (files.length === 0) {
      if (selectedPath) {
        setSelectedPath('');
      }
      return;
    }

    if (!files.some((entry) => entry.path === selectedPath)) {
      setSelectedPath(files[0].path);
    }
  }, [files, selectedPath]);

  const selectedFile = files.find((entry) => entry.path === selectedPath) ?? files[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gh-border bg-gh-surface/30 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gh-text">{getArtifactGroupLabel(group)}</h3>
              <span className="rounded-full border px-2 py-1 text-[11px] font-medium capitalize text-gh-muted">
                {group.status}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gh-muted">{getArtifactGroupDescription(group)}</p>
          </div>
          <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
            {group.path}
          </span>
        </div>
      </div>

      {group.status !== 'ok' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
            {group.message ?? 'No artifact content is available for this tab.'}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-r border-gh-border bg-gh-surface/20 p-3">
            {files.length > 0 ? (
              <ul className="space-y-2">
                {group.entries?.map((entry) => (
                  <ArtifactEntryTree
                    key={entry.path}
                    entry={entry}
                    selectedPath={selectedPath}
                    onSelectFile={setSelectedPath}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-gh-border bg-gh-bg/50 p-4 text-sm text-gh-muted">
                No text files were found in this artifact group.
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-y-auto p-4">
            {selectedFile ? (
              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-gh-text">{selectedFile.name}</h4>
                    <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] text-gh-muted">
                      file
                    </span>
                    <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] text-gh-muted">
                      {formatBytes(selectedFile.sizeBytes)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-gh-muted">{selectedFile.path}</p>
                </div>
                <div className="rounded-xl border border-gh-border bg-gh-bg/30 p-4">
                  {renderArtifactContent(selectedFile, sessionId, group.path === 'checkpoints')}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
                Select a file to view its full content.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

interface TodoGraphNode {
  todo: TodoItem;
  depth: number;
  dependencyCount: number;
  dependentCount: number;
  missingDependencyIds: string[];
  blockedByDependencies: boolean;
  isReady: boolean;
}

interface TodoGraphEdge {
  from: TodoItem;
  to: TodoItem;
}

function buildTodoGraph(todos: TodoItem[]) {
  const todoById = new Map(todos.map((todo) => [todo.id, todo] as const));
  const dependentCountById = new Map<string, number>();

  todos.forEach((todo) => {
    todo.dependsOn.forEach((dependencyId) => {
      dependentCountById.set(dependencyId, (dependentCountById.get(dependencyId) ?? 0) + 1);
    });
  });

  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();

  function getDepth(todo: TodoItem): number {
    const memoized = depthMemo.get(todo.id);
    if (memoized !== undefined) {
      return memoized;
    }

    if (visiting.has(todo.id)) {
      return 0;
    }

    visiting.add(todo.id);
    const dependencyDepths = todo.dependsOn
      .map((dependencyId) => todoById.get(dependencyId))
      .filter((dependency): dependency is TodoItem => Boolean(dependency))
      .map((dependency) => getDepth(dependency) + 1);
    visiting.delete(todo.id);

    const depth = dependencyDepths.length > 0 ? Math.max(...dependencyDepths) : 0;
    depthMemo.set(todo.id, depth);
    return depth;
  }

  const nodes: TodoGraphNode[] = todos.map((todo) => {
    const resolvedDependencies = todo.dependsOn
      .map((dependencyId) => todoById.get(dependencyId))
      .filter((dependency): dependency is TodoItem => Boolean(dependency));
    const missingDependencyIds = todo.dependsOn.filter((dependencyId) => !todoById.has(dependencyId));
    const blockedByDependencies = resolvedDependencies.some((dependency) => !isDone(dependency.status));

    return {
      todo,
      depth: getDepth(todo),
      dependencyCount: todo.dependsOn.length,
      dependentCount: dependentCountById.get(todo.id) ?? 0,
      missingDependencyIds,
      blockedByDependencies,
      isReady: todo.status === 'in_progress' && !blockedByDependencies,
    };
  });

  const layers = Array.from(new Map(nodes.map((node) => [node.depth, [] as TodoGraphNode[]]))).sort(
    (left, right) => left[0] - right[0],
  );
  nodes.forEach((node) => {
    const layer = layers.find(([depth]) => depth === node.depth);
    layer?.[1].push(node);
  });

  const edges: TodoGraphEdge[] = [];
  todos.forEach((todo) => {
    todo.dependsOn.forEach((dependencyId) => {
      const dependency = todoById.get(dependencyId);
      if (dependency) {
        edges.push({ from: todo, to: dependency });
      }
    });
  });

  return {
    nodes,
    layers: layers.map(([, layerNodes]) => layerNodes),
    edges,
  };
}

function TodoGraphNodeCard({ node }: { node: TodoGraphNode }) {
  const { todo } = node;
  const status = STATUS_CONFIG[todo.status] ?? { label: todo.status, dot: 'bg-gh-muted', text: 'text-gh-muted' };

  return (
    <article className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-gh-text">{todo.title}</h4>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gh-muted">{todo.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${status.text} border-gh-border bg-gh-bg/70`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          {node.blockedByDependencies && !isDone(todo.status) && (
            <span className="rounded-full border border-gh-attention/30 bg-gh-attention/10 px-2 py-1 text-[11px] font-medium text-gh-attention">
              Blocked by deps
            </span>
          )}
          {node.isReady && (
            <span className="rounded-full border border-gh-active/30 bg-gh-active/10 px-2 py-1 text-[11px] font-medium text-gh-active">
              Ready
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-[11px] text-gh-muted sm:grid-cols-2">
        <div className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-2 py-1.5">
          <dt className="uppercase tracking-wide text-gh-muted/70">Created</dt>
          <dd className="mt-0.5">
            <RelativeTime timestamp={todo.createdAt} />
          </dd>
        </div>
        <div className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-2 py-1.5">
          <dt className="uppercase tracking-wide text-gh-muted/70">Updated</dt>
          <dd className="mt-0.5">
            <RelativeTime timestamp={todo.updatedAt} />
          </dd>
        </div>
        <div className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-2 py-1.5">
          <dt className="uppercase tracking-wide text-gh-muted/70">Dependencies</dt>
          <dd className="mt-0.5">
            {node.dependencyCount} direct · {node.missingDependencyIds.length} missing
          </dd>
        </div>
        <div className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-2 py-1.5">
          <dt className="uppercase tracking-wide text-gh-muted/70">Dependents</dt>
          <dd className="mt-0.5">{node.dependentCount} downstream</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-gh-muted/70">Depends on</span>
        {todo.dependsOn.length > 0 ? (
          todo.dependsOn.map((dependencyId) => (
            <span key={dependencyId} className="rounded-full border border-gh-border bg-gh-bg/80 px-2 py-0.5 font-mono text-gh-muted">
              {dependencyId}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-gh-border bg-gh-bg/80 px-2 py-0.5 text-gh-muted">None</span>
        )}
      </div>
    </article>
  );
}

function SessionDbDependencyGraph({
  todoInspection,
  todoDepsInspection,
  fallbackTodos,
  onOpenTablePreview,
  tableCount,
  loading,
  error,
}: {
  todoInspection: SessionDbInspection | null;
  todoDepsInspection: SessionDbInspection | null;
  fallbackTodos: TodoItem[];
  onOpenTablePreview: () => void;
  tableCount: number;
  loading: boolean;
  error: string | null;
}) {
  const graphTodos = useMemo(
    () => buildTodoItemsFromDb(todoInspection, todoDepsInspection, fallbackTodos),
    [fallbackTodos, todoDepsInspection, todoInspection],
  );
  const graph = useMemo(() => buildTodoGraph(graphTodos), [graphTodos]);
  const completedCount = graphTodos.filter((todo) => isDone(todo.status)).length;
  const activeCount = graphTodos.filter((todo) => todo.status === 'in_progress').length;
  const blockedCount = graph.nodes.filter((node) => node.todo.status === 'blocked' || (node.blockedByDependencies && !isDone(node.todo.status))).length;
  const isPreviewLimited = Boolean(
    (todoInspection && todoInspection.table.rowCount > todoInspection.table.rows.length) ||
      (todoDepsInspection && todoDepsInspection.table.rowCount > todoDepsInspection.table.rows.length),
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gh-border bg-gh-surface/30 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gh-text">Todo dependency graph</p>
          <p className="mt-1 text-xs leading-5 text-gh-muted">
            {loading && graphTodos.length === 0
              ? 'Loading todo and dependency tables…'
              : graphTodos.length > 0
                ? `${graphTodos.length} todo${graphTodos.length === 1 ? '' : 's'} · ${activeCount} active · ${blockedCount} blocked · ${completedCount} done`
                : 'No todo graph data was captured for this session.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTablePreview}
          className="rounded-full border border-gh-border bg-gh-bg/70 px-3 py-1.5 text-xs font-medium text-gh-muted transition-colors hover:border-gh-border hover:text-gh-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface"
        >
          Open table preview
        </button>
      </div>

      {error && graphTodos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      ) : graphTodos.length > 0 ? (
        <>
          {error && (
            <div className="mt-4 rounded-xl border border-gh-warning/30 bg-gh-warning/10 p-3 text-xs text-gh-warning">
              {error}
            </div>
          )}
          <div className="mt-4 space-y-4">
            {graph.layers.map((layer, index) => (
              <section key={`layer-${index}`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gh-muted">
                    Layer {index + 1}
                  </span>
                  <span className="text-[11px] text-gh-muted">{layer.length} item{layer.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {layer.map((node) => (
                    <TodoGraphNodeCard key={node.todo.id} node={node} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-4 rounded-xl border border-gh-border bg-gh-surface/30 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gh-text">Relationship edges</h3>
              <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
                {graph.edges.length} edges
              </span>
            </div>
            {graph.edges.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {graph.edges.map((edge) => (
                  <li key={`${edge.from.id}->${edge.to.id}`} className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-3 py-2 text-xs text-gh-text">
                    <span className="font-medium">{edge.from.title}</span>
                    <span className="mx-2 text-gh-muted">→</span>
                    <span className="text-gh-muted">{edge.to.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-gh-muted">No dependency edges were recorded.</p>
            )}
          </section>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-gh-border bg-gh-surface/20 p-4 text-sm text-gh-muted">
          Open the table preview to inspect the raw session.db tables and rows.
        </div>
      )}

      <div className="mt-4 space-y-2 text-xs text-gh-muted">
        {isPreviewLimited && (
          <p>
            The graph is built from preview rows; open the table preview if you need the raw session.db slices.
          </p>
        )}
        {tableCount > 0 && (
          <p>The table-oriented preview remains available if you need to inspect raw schema and rows.</p>
        )}
      </div>
    </div>
  );
}

function SessionDbModeToggle({
  value,
  onChange,
}: {
  value: SessionDbViewMode;
  onChange: (value: SessionDbViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-gh-border bg-gh-surface/50 p-1">
      {([
        { value: 'graph', label: 'Dependency graph' },
        { value: 'table', label: 'Table preview' },
      ] as const).map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
              isActive
                ? 'bg-gh-accent/15 text-gh-text'
                : 'text-gh-muted hover:text-gh-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ThreadListItem({
  agent,
  isSelected,
  onSelect,
}: {
  agent: ActiveSubAgent;
  isSelected: boolean;
  onSelect: (threadId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.toolCallId)}
      aria-pressed={isSelected}
      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
        isSelected
          ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
          : 'border-gh-border bg-gh-bg/70 text-gh-muted hover:border-gh-border hover:text-gh-text'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {agent.agentDisplayName || agent.agentName}
          </p>
          {agent.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gh-muted/90">
              {agent.description}
            </p>
          )}
        </div>
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            agent.isCompleted ? 'bg-gh-muted' : 'bg-gh-active animate-pulse'
          }`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

function ThreadExplorer({
  session,
  subAgents,
  selectedThreadId,
  onThreadChange,
}: {
  session: SessionDetailData;
  subAgents: ActiveSubAgent[];
  selectedThreadId: string;
  onThreadChange: (threadId: string) => void;
}) {
  const [threadSearch, setThreadSearch] = useState('');
  const filteredThreads = useMemo(() => {
    const normalized = threadSearch.trim().toLowerCase();
    if (!normalized) {
      return subAgents;
    }

    return subAgents.filter((agent) => {
      const searchable = [
        agent.agentDisplayName,
        agent.agentName,
        agent.description,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalized);
    });
  }, [subAgents, threadSearch]);
  const hasMatchingThreads = filteredThreads.length > 0;
  const runningThreads = filteredThreads.filter((agent) => !agent.isCompleted);
  const completedThreads = filteredThreads.filter((agent) => agent.isCompleted);
  const selectedThread = hasMatchingThreads
    ? subAgents.find((agent) => agent.toolCallId === selectedThreadId) ?? filteredThreads[0] ?? subAgents[0] ?? null
    : null;
  const selectedMessages = selectedThread ? session.subAgentMessages?.[selectedThread.toolCallId] ?? [] : [];

  useEffect(() => {
    if (filteredThreads.length === 0) {
      return;
    }

    if (!filteredThreads.some((agent) => agent.toolCallId === selectedThreadId)) {
      onThreadChange(filteredThreads[0].toolCallId);
    }
  }, [filteredThreads, onThreadChange, selectedThreadId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-xl border border-gh-border bg-gh-surface/30 p-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">Search threads</span>
            <input
              type="search"
              value={threadSearch}
              onChange={(event) => setThreadSearch(event.target.value)}
              placeholder="Filter by thread name or summary"
              className="h-9 min-w-0 rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors focus:border-gh-accent focus:outline-none"
            />
          </label>

          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gh-muted">Running</h3>
                <span className="text-[11px] text-gh-muted">{runningThreads.length}</span>
              </div>
              <div className="space-y-2">
                {runningThreads.map((agent) => (
                  <ThreadListItem
                    key={agent.toolCallId}
                    agent={agent}
                    isSelected={agent.toolCallId === selectedThread?.toolCallId}
                    onSelect={onThreadChange}
                  />
                ))}
                {runningThreads.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gh-border bg-gh-bg/60 px-3 py-3 text-xs text-gh-muted">
                    No running threads match the current search.
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gh-muted">Done</h3>
                <span className="text-[11px] text-gh-muted">{completedThreads.length}</span>
              </div>
              <div className="space-y-2">
                {completedThreads.map((agent) => (
                  <ThreadListItem
                    key={agent.toolCallId}
                    agent={agent}
                    isSelected={agent.toolCallId === selectedThread?.toolCallId}
                    onSelect={onThreadChange}
                  />
                ))}
                {completedThreads.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gh-border bg-gh-bg/60 px-3 py-3 text-xs text-gh-muted">
                    No completed threads match the current search.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gh-border bg-gh-bg/30">
          <div className="shrink-0 border-b border-gh-border bg-gh-surface/40 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gh-text">
                  {selectedThread ? selectedThread.agentDisplayName || selectedThread.agentName : 'No thread selected'}
                </p>
                <p className="mt-1 text-xs leading-5 text-gh-muted">
                  {selectedThread?.description || 'Choose a thread from the list to inspect its messages.'}
                </p>
              </div>
              {selectedThread && (
                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
                  selectedThread.isCompleted
                    ? 'border-gh-border bg-gh-bg/70 text-gh-muted'
                    : 'border-gh-active/30 bg-gh-active/10 text-gh-active'
                }`}>
                  {selectedThread.isCompleted ? 'Done' : 'Running'}
                </span>
              )}
            </div>
          </div>

          {hasMatchingThreads ? (
            <MessageList messages={selectedMessages} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-gh-muted">
              No threads match the current search.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SessionDbInspector({
  inspection,
  selectedTable,
  onTableChange,
  limit,
}: {
  inspection: SessionDbInspection;
  selectedTable: string;
  onTableChange: (table: string) => void;
  limit: number;
}) {
  const table = inspection.table;
  const rows = table.rows;
  const columns = table.columns;
  const [rowFilter, setRowFilter] = useState('');
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesFilter(row, rowFilter)),
    [rowFilter, rows],
  );
  const rowColumns = columns.length > 0 ? columns : Object.keys(rows[0] ?? {}).map((name) => ({
    name,
    type: 'unknown',
    notNull: false,
    defaultValue: null,
    isPrimaryKey: false,
    primaryKeyOrder: 0,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <BrowseSelect
          label="Table"
          value={selectedTable || inspection.availableTables[0] || ''}
          onChange={onTableChange}
          options={inspection.availableTables.map((name) => ({ value: name, label: name }))}
        />
        <div className="rounded-xl border border-gh-border bg-gh-surface/30 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gh-muted">Database path</p>
          <p className="mt-1 truncate font-mono text-xs text-gh-text" title={inspection.databasePath}>
            {inspection.databasePath}
          </p>
          <p className="mt-2 text-xs text-gh-muted">
            Showing {Math.min(limit, filteredRows.length)} of {table.rowCount} row{table.rowCount === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      <label className="mt-3 flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">
          Filter rows
        </span>
        <input
          type="text"
          value={rowFilter}
          onChange={(event) => setRowFilter(event.target.value)}
          placeholder="Use column:value or search text"
          className="h-8 min-w-0 rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors focus:border-gh-accent focus:outline-none"
        />
      </label>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section className="rounded-xl border border-gh-border bg-gh-surface/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gh-text">Schema</h3>
            <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
              {columns.length} column{columns.length === 1 ? '' : 's'}
            </span>
          </div>

          {columns.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {columns.map((column) => (
                <li key={column.name} className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gh-text">{column.name}</span>
                    <span className="rounded-full border border-gh-border bg-gh-surface px-2 py-0.5 text-[11px] text-gh-muted">
                      {column.type || 'unknown'}
                    </span>
                    {column.isPrimaryKey && (
                      <span className="rounded-full border border-gh-active/20 bg-gh-active/10 px-2 py-0.5 text-[11px] text-gh-active">
                        PK
                      </span>
                    )}
                    {column.notNull && (
                      <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] text-gh-muted">
                        NOT NULL
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gh-muted">
                    Default {column.defaultValue ?? '—'} · PK order {column.primaryKeyOrder}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-gh-muted">No schema metadata available for this table.</p>
          )}
        </section>

        <section className="rounded-xl border border-gh-border bg-gh-surface/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gh-text">Row preview</h3>
            <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
              {table.type}
            </span>
            <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
              {table.rowCount} rows
            </span>
          </div>

          {table.sql ? (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-gh-border bg-gh-bg/70 p-3 text-[11px] leading-relaxed text-gh-muted">
              {table.sql}
            </pre>
          ) : null}

          {filteredRows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-gh-border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gh-surface/70 text-gh-muted">
                  <tr>
                    {rowColumns.map((column) => (
                      <th key={column.name} className="border-b border-gh-border px-3 py-2 font-medium">
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gh-border/60 bg-gh-bg/50">
                  {filteredRows.map((row, index) => (
                    <tr key={`${table.name}-${index}`} className="align-top even:bg-gh-surface/20">
                      {rowColumns.map((column) => (
                        <td key={column.name} className="max-w-[18rem] border-r border-gh-border/40 px-3 py-2 text-gh-text last:border-r-0">
                          <span className="block whitespace-pre-wrap break-words">
                            {formatPreviewValue(row[column.name])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gh-muted">
              {rowFilter.trim()
                ? 'No rows match the current filter.'
                : 'No preview rows returned for this table.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Sessions sidebar ───────────────────────────────────────────────────────

const SIDEBAR_PAGE_SIZE = 10;

  function SessionSidebar({
  currentId,
  currentProjectPath,
  sessions,
  }: {
    currentId: string;
    currentProjectPath: string;
    sessions: SessionSummary[];
  }) {
  const navigate = useNavigate();
  const currentProjectKey = useMemo(
    () => normalizeProjectPathForComparison(currentProjectPath),
    [currentProjectPath],
  );
  const currentProjectSessions = useMemo(
    () => sessions.filter((session) => normalizeProjectPathForComparison(session.projectPath) === currentProjectKey),
    [currentProjectKey, sessions],
  );
  const [browseState, setBrowseState] = useState(() => ({
    ...DEFAULT_SESSION_BROWSE_STATE,
    projectPath: currentProjectPath,
    pageSize: SIDEBAR_PAGE_SIZE,
  }));

  useEffect(() => {
    setBrowseState((previous) => ({
      ...previous,
      projectPath: currentProjectPath,
      branch: normalizeProjectPathForComparison(previous.projectPath ?? '') === currentProjectKey
        ? previous.branch
        : null,
      page: 1,
    }));
  }, [currentProjectKey, currentProjectPath]);

  const browse = useSessionBrowse(currentProjectSessions, browseState);
  const groupedSessions = useMemo(() => {
    const openSessions = browse.filteredSessions.filter((session) => session.isOpen);
    const closedSessions = browse.filteredSessions.filter((session) => !session.isOpen);
    return [...openSessions, ...closedSessions];
  }, [browse.filteredSessions]);
  const pagination = useMemo(
    () => paginateSessionsForBrowse(groupedSessions, browse.page, browse.pageSize),
    [browse.page, browse.pageSize, groupedSessions],
  );
  const open = pagination.paginatedSessions.filter((session) => session.isOpen);
  const closed = pagination.paginatedSessions.filter((session) => !session.isOpen);

  function statusDot(s: SessionSummary) {
    if (s.needsAttention) return 'bg-gh-attention animate-pulse';
    if (s.isWorking)      return 'bg-gh-active animate-pulse';
    if (s.isTaskComplete) return 'bg-gh-active';
    if (s.isAborted)      return 'bg-red-500';
    return 'bg-gh-muted/40';
  }

  function SessionItem({ s }: { s: SessionSummary }) {
    const isCurrent = s.id === currentId;
    const secondaryLabel = s.gitBranch || getProjectLabel(s.projectPath);

    return (
      <button
        key={s.id}
        onClick={() => navigate(`/sessions/${s.id}`)}
        className={`w-full px-3 py-2.5 text-left flex items-start gap-2 transition-colors hover:bg-gh-surface/60
          ${isCurrent ? 'bg-gh-surface border-l-2 border-gh-accent' : 'border-l-2 border-transparent'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${statusDot(s)}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate leading-snug ${isCurrent ? 'text-gh-text' : 'text-gh-muted'}`}>
              {s.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span
                className={`text-xs truncate ${s.gitBranch ? 'font-mono text-gh-accent/80' : 'text-gh-muted/50'}`}
                title={secondaryLabel}
              >
                {secondaryLabel}
              </span>
              <span className="text-gh-muted/30 shrink-0">·</span>
              <RelativeTime timestamp={s.lastActivityAt} className="text-xs text-gh-muted/50 shrink-0" />
            </div>
          </div>
        </button>
      );
    }

  function handleBranchChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      branch: value || null,
      page: 1,
    }));
  }

  function handleStatusChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      status: value ? (value as SessionBrowseStatus) : null,
      page: 1,
    }));
  }

  function handleSortFieldChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      sortField: value as SessionBrowseSortField,
      page: 1,
    }));
  }

  function handleSortOrderChange(value: 'asc' | 'desc') {
    setBrowseState((previous) => ({
      ...previous,
      sortOrder: value,
      page: 1,
    }));
  }

  function handlePageChange(page: number) {
    setBrowseState((previous) => ({
      ...previous,
      page,
    }));
  }

  function handleShowUnknownChange(checked: boolean) {
    setBrowseState((previous) => ({
      ...previous,
      showUnknownContext: checked,
      page: 1,
    }));
  }

    return (
      <div className="flex h-full min-w-0 min-h-0 flex-col">
        <div className="rounded-lg border border-gh-border overflow-hidden flex flex-col min-h-0 flex-1">
        <div className="shrink-0 border-b border-gh-border bg-gh-surface">
          <div className="flex items-start justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <span className="text-xs font-medium text-gh-muted uppercase tracking-wider">Sessions</span>
              <p className="mt-1 truncate text-[11px] font-mono text-gh-muted/60" title={currentProjectPath}>
                {getProjectLabel(currentProjectPath)}
              </p>
            </div>
            <span className="text-xs text-gh-muted/60">{pagination.totalItems}</span>
          </div>

          <div className="grid gap-2 border-t border-gh-border/60 px-3 py-2">
            <BrowseSelect
              label="Branch"
              value={browse.branch ?? ''}
              onChange={handleBranchChange}
              options={[
                { value: '', label: 'All branches' },
                ...browse.branchOptions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
            />
            <BrowseSelect
              label="Status"
              value={browse.status ?? ''}
              onChange={handleStatusChange}
              options={[
                { value: '', label: 'All statuses' },
                ...SESSION_BROWSE_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
              <BrowseSelect
                label="Sort"
                value={browseState.sortField}
                onChange={handleSortFieldChange}
                options={SESSION_BROWSE_SORT_FIELDS.map((field) => ({
                  value: field,
                  label: SESSION_BROWSE_SORT_FIELD_LABELS[field],
                }))}
              />
              <BrowseSortOrderToggle value={browseState.sortOrder} onChange={handleSortOrderChange} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Open sessions */}
          {open.length > 0 && (
            <div className="bg-gh-active/5 border-b border-gh-active/20"
              style={{ boxShadow: 'inset 0 0 12px 0 rgba(63,185,80,0.06)' }}>
              <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-gh-active/15">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
                <span className="text-xs font-medium text-gh-active/80">Open · {open.length}</span>
              </div>
              <div className="divide-y divide-gh-active/10">
                {open.map((s) => <SessionItem key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {/* Closed sessions */}
          {closed.length > 0 && (
            <div className="bg-gh-bg">
              <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-gh-border/40 bg-gh-surface/30">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-muted/30" />
                <span className="text-xs font-medium text-gh-muted/50">Closed · {closed.length}</span>
              </div>
              <div className="divide-y divide-gh-border/20 opacity-70">
                {closed.map((s) => <SessionItem key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {pagination.totalItems === 0 && (
            <p className="px-3 py-6 text-xs text-gh-muted text-center">No sessions match these filters.</p>
          )}
        </div>
        {pagination.totalItems > 0 && (
          <div className="shrink-0 border-t border-gh-border bg-gh-surface/40 px-3 py-2">
            <BrowsePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={handlePageChange}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, error } = useSession(id ?? '');
  const { sessions } = useSessions();
  const [activeView, setActiveView] = useState<SessionDetailView>('main');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [selectedDbTable, setSelectedDbTable] = useState('');
  const [dbViewMode, setDbViewMode] = useState<SessionDbViewMode>('graph');
  const [showSessionSidebar, setShowSessionSidebar] = useState(false);
  const subAgents = useMemo(() => [...(session?.activeSubAgents ?? [])].reverse(), [session?.activeSubAgents]);
  const hasPlan = Boolean(session?.hasPlan || session?.planContent);
  const hasTodos = (session?.todos?.length ?? 0) > 0;
  const { artifacts, loading: artifactsLoading, error: artifactsError } = useSessionArtifacts(session?.id ?? '');
  const {
    inspection: sessionDbInspection,
    loading: sessionDbLoading,
    error: sessionDbError,
  } = useSessionDbInspection(session?.id ?? '', selectedDbTable, DEFAULT_DB_PREVIEW_LIMIT);
  const {
    inspection: todoDbInspection,
    loading: todoDbLoading,
    error: todoDbError,
  } = useSessionDbInspection(session?.id ?? '', 'todos', DEFAULT_DB_GRAPH_LIMIT);
  const {
    inspection: todoDepsDbInspection,
    loading: todoDepsDbLoading,
    error: todoDepsDbError,
  } = useSessionDbInspection(session?.id ?? '', 'todo_deps', DEFAULT_DB_GRAPH_LIMIT);

  useLayoutEffect(() => {
    setActiveView('main');
    setSelectedThreadId('');
    setSelectedDbTable('');
    setDbViewMode('graph');
    setShowSessionSidebar(false);
  }, [id]);

  useEffect(() => {
    if (!session?.isPlanPending || !hasPlan) {
      return;
    }

    setActiveView((currentView) => (currentView === 'main' ? 'plan' : currentView));
  }, [hasPlan, session?.id, session?.isPlanPending]);

  useEffect(() => {
    if (subAgents.length === 0) {
      setSelectedThreadId('');
      return;
    }

    const preferredThread = subAgents.find((agent) => !agent.isCompleted)?.toolCallId ?? subAgents[0].toolCallId;
    if (!subAgents.some((agent) => agent.toolCallId === selectedThreadId)) {
      setSelectedThreadId(preferredThread);
    }
  }, [selectedThreadId, subAgents]);

  useEffect(() => {
    const firstTable = sessionDbInspection?.availableTables[0];
    if (!sessionDbInspection || !firstTable) {
      return;
    }

    if (!selectedDbTable || !sessionDbInspection.availableTables.includes(selectedDbTable)) {
      setSelectedDbTable(firstTable);
    }
  }, [selectedDbTable, sessionDbInspection]);

  if (loading && !session) return <LoadingSpinner />;
  if (error) return (
    <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">{error}</div>
  );
  if (!session) return null;

  const checkpointGroup = getArtifactGroupByPath(artifacts, 'checkpoints');
  const researchGroup = getArtifactGroupByPath(artifacts, 'research');
  const filesGroup = getArtifactGroupByPath(artifacts, 'files');

  const availableViews = DETAIL_VIEW_OPTIONS.filter((option) => {
    if (option.value === 'plan') {
      return hasPlan;
    }

    if (option.value === 'todos') {
      return hasTodos;
    }

    if (option.value === 'threads') {
      return subAgents.length > 0;
    }

    if (option.value === 'checkpoints') {
      return checkpointGroup?.status === 'ok';
    }

    if (option.value === 'research') {
      return researchGroup?.status === 'ok';
    }

    if (option.value === 'files') {
      return filesGroup?.status === 'ok';
    }

    return true;
  });
  const resolvedView = availableViews.some((option) => option.value === activeView) ? activeView : 'main';
  const selectedThread = subAgents.find((agent) => agent.toolCallId === selectedThreadId) ?? subAgents.find((agent) => !agent.isCompleted) ?? subAgents[0] ?? null;
  const activeThreadCount = subAgents.filter((agent) => !agent.isCompleted).length;
  const completedThreadCount = subAgents.filter((agent) => agent.isCompleted).length;
  const activeTodos = (session.todos ?? []).filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = (session.todos ?? []).filter((todo) => todo.status === 'blocked').length;
  const completedTodos = (session.todos ?? []).filter((todo) => isDone(todo.status)).length;
  const detailTabs: SessionDetailTab[] = availableViews.map((option) => {
    const descriptionByValue: Record<SessionDetailView, string> = {
      main: `${session.messageCount} messages in the primary conversation.`,
      plan: session.isPlanPending
        ? 'Plan approval is pending before execution continues.'
        : 'Captured plan content available for reference.',
      todos: hasTodos
        ? `${activeTodos} active · ${blockedTodos} blocked · ${completedTodos}/${session.todos?.length ?? 0} done`
        : 'No todos are recorded for this session yet.',
      threads: `${activeThreadCount} running · ${completedThreadCount} done`,
      checkpoints: checkpointGroup?.status === 'ok'
        ? `${collectArtifactFiles(checkpointGroup.entries ?? []).length} checkpoint files available.`
        : 'Checkpoint artifacts from this session.',
      research: researchGroup?.status === 'ok'
        ? `${collectArtifactFiles(researchGroup.entries ?? []).length} research files available.`
        : 'Research artifacts from this session.',
      files: filesGroup?.status === 'ok'
        ? `${collectArtifactFiles(filesGroup.entries ?? []).length} files available.`
        : 'Additional files from this session.',
      'session-db': 'Todo dependency graph with table preview fallback.',
    };

    return {
      id: option.value,
      label: option.label,
      description: descriptionByValue[option.value],
      isCompleted: option.value === 'threads' ? completedThreadCount > 0 && activeThreadCount === 0 : undefined,
      isSubAgent: option.value === 'threads',
      isArtifact: option.value === 'checkpoints' || option.value === 'research' || option.value === 'files',
      artifactKind: option.value === 'checkpoints' ? 'checkpoints' : option.value === 'research' ? 'research' : option.value === 'files' ? 'files' : undefined,
      isPlan: option.value === 'plan',
      isPlanPending: option.value === 'plan' && session.isPlanPending,
      isTodos: option.value === 'todos',
      isMain: option.value === 'main',
      accentColor: option.value === 'threads'
        ? 'sky'
        : option.value === 'research'
          ? 'sky'
          : 'blue',
    };
  });
  const detailPanelClassName = `flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-gh-bg/20 ${modeBorderClass(session.currentMode)}`;
  const detailGridClassName = showSessionSidebar
    ? 'grid h-full w-full min-h-0 gap-3 xl:grid-cols-[minmax(16rem,500px)_minmax(0,1fr)_minmax(18rem,0.85fr)] 2xl:grid-cols-[minmax(16rem,500px)_minmax(0,1fr)_minmax(20rem,0.95fr)] xl:gap-4'
    : 'grid h-full w-full min-h-0 gap-3 xl:grid-cols-[minmax(16rem,500px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(16rem,500px)_minmax(0,1fr)] xl:gap-4';

  function handleViewChange(view: SessionDetailView) {
    setActiveView(view);
  }

  function handleThreadChange(threadId: string) {
    setSelectedThreadId(threadId);
    setActiveView('threads');
  }

  function handleDbViewModeChange(mode: SessionDbViewMode) {
    setDbViewMode(mode);
    setActiveView('session-db');
  }

  return (
    <div className={detailGridClassName}>
      <section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-gh-border bg-gh-surface/20 p-4">
        <SessionMeta session={session} />
      </section>

      <section className={detailPanelClassName} aria-labelledby="session-detail-panel-heading">
        <DetailPanelHeader
          session={session}
          activeView={resolvedView}
          activeThread={selectedThread}
          dbViewMode={dbViewMode}
          selectedDbTable={selectedDbTable}
          artifacts={artifacts}
          showSessionSidebar={showSessionSidebar}
          onToggleSessionSidebar={() => setShowSessionSidebar((previous) => !previous)}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 xl:flex-row" role="region" aria-labelledby="session-detail-panel-heading">
          <aside className="min-h-0 overflow-y-auto rounded-xl border border-gh-border bg-gh-surface/20 p-3 xl:w-[18rem] xl:flex-shrink-0">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-gh-muted">Views</div>
            <SessionTabNav tabs={detailTabs} activeId={resolvedView} onChange={(id) => handleViewChange(id as SessionDetailView)} />
          </aside>

          <div
            id={getSessionDetailPanelId(resolvedView)}
            role="tabpanel"
            aria-labelledby={getSessionDetailTabId(resolvedView)}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-gh-border bg-gh-bg/20"
          >
            {resolvedView === 'main' && (
              <MessageList messages={session.messages} />
            )}

            {resolvedView === 'plan' && (
              session.planContent ? (
                <PlanView content={session.planContent} isPending={session.isPlanPending} />
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    No plan content was captured for this session.
                  </div>
                </div>
              )
            )}

            {resolvedView === 'todos' && (
              session.todos?.length ? (
                <TodosView todos={session.todos} />
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    No todos are recorded for this session.
                  </div>
                </div>
              )
            )}

            {resolvedView === 'threads' && (
              subAgents.length > 0 ? (
                <ThreadExplorer
                  session={session}
                  subAgents={subAgents}
                  selectedThreadId={selectedThread?.toolCallId ?? selectedThreadId}
                  onThreadChange={handleThreadChange}
                />
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    No sub-agent threads were captured for this session.
                  </div>
                </div>
              )
            )}

            {resolvedView === 'checkpoints' && (
              <div className="flex min-h-0 flex-1 flex-col">
                {artifactsLoading && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      Loading checkpoint files…
                    </div>
                  </div>
                )}
                {artifactsError && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
                      {artifactsError}
                    </div>
                  </div>
                )}
                {artifacts && checkpointGroup && <ArtifactGroupPanel group={checkpointGroup} sessionId={session.id} />}
                {artifacts && !checkpointGroup && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No checkpoint artifact group was returned for this session.
                    </div>
                  </div>
                )}
                {!artifactsLoading && !artifactsError && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No checkpoint artifact data was returned for this session.
                    </div>
                  </div>
                )}
              </div>
            )}

            {resolvedView === 'research' && (
              <div className="flex min-h-0 flex-1 flex-col">
                {artifactsLoading && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      Loading research files…
                    </div>
                  </div>
                )}
                {artifactsError && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
                      {artifactsError}
                    </div>
                  </div>
                )}
                {artifacts && researchGroup && <ArtifactGroupPanel group={researchGroup} sessionId={session.id} />}
                {artifacts && !researchGroup && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No research artifact group was returned for this session.
                    </div>
                  </div>
                )}
                {!artifactsLoading && !artifactsError && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No research artifact data was returned for this session.
                    </div>
                  </div>
                )}
              </div>
            )}

            {resolvedView === 'files' && (
              <div className="flex min-h-0 flex-1 flex-col">
                {artifactsLoading && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      Loading files…
                    </div>
                  </div>
                )}
                {artifactsError && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
                      {artifactsError}
                    </div>
                  </div>
                )}
                {artifacts && filesGroup && <ArtifactGroupPanel group={filesGroup} sessionId={session.id} />}
                {artifacts && !filesGroup && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No files artifact group was returned for this session.
                    </div>
                  </div>
                )}
                {!artifactsLoading && !artifactsError && !artifacts && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No files artifact data was returned for this session.
                    </div>
                  </div>
                )}
              </div>
            )}

            {resolvedView === 'session-db' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-gh-border bg-gh-surface/30 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gh-text">
                        {dbViewMode === 'graph' ? 'Todo dependency graph' : 'Table preview'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gh-muted">
                        {dbViewMode === 'graph'
                          ? 'Read-only graph of todos and todo dependencies.'
                          : 'Read-only schema summary and bounded row preview.'}
                      </p>
                    </div>
                    <SessionDbModeToggle value={dbViewMode} onChange={handleDbViewModeChange} />
                  </div>
                </div>

                {sessionDbLoading && !sessionDbInspection && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      Loading session database…
                    </div>
                  </div>
                )}
                {sessionDbError && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
                      {sessionDbError}
                    </div>
                  </div>
                )}
                {dbViewMode === 'graph' && (
                  <SessionDbDependencyGraph
                    todoInspection={todoDbInspection}
                    todoDepsInspection={todoDepsDbInspection}
                    fallbackTodos={[]}
                    onOpenTablePreview={() => handleDbViewModeChange('table')}
                    tableCount={sessionDbInspection?.availableTables.length ?? 0}
                    loading={todoDbLoading || todoDepsDbLoading}
                    error={todoDbError || todoDepsDbError}
                  />
                )}
                {dbViewMode === 'table' && sessionDbInspection && sessionDbInspection.availableTables.length > 0 && (
                  <SessionDbInspector
                    inspection={sessionDbInspection}
                    selectedTable={selectedDbTable}
                    onTableChange={setSelectedDbTable}
                    limit={DEFAULT_DB_PREVIEW_LIMIT}
                  />
                )}
                {dbViewMode === 'table' && !sessionDbLoading && !sessionDbError && sessionDbInspection && sessionDbInspection.availableTables.length === 0 && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                      No tables were found in the session database.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={showSessionSidebar ? 'block' : 'block xl:hidden'}>
        <SessionSidebar currentId={id ?? ''} currentProjectPath={session.projectPath} sessions={sessions} />
      </div>
    </div>
  );
}
