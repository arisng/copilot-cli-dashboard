import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
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
import { modeBorderClass } from '../shared/modeBadge.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { RelativeTime } from '../shared/RelativeTime.tsx';
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
import { fetchSessionArtifacts, fetchSessionDb } from '../../api/client.ts';

// ── Plan markdown components ───────────────────────────────────────────────

const planComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-gh-text border-b border-gh-border pb-2 mb-4 mt-6 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-gh-accent mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-gh-text uppercase tracking-wide mt-4 mb-1.5 opacity-80">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gh-text leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 mb-3 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-3 pl-0 list-none counter-reset-[item]">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    // Detect task list items (checkboxes)
    const childArr = Array.isArray(children) ? children : [children];
    const hasCheckbox = childArr.some(
      (c) => typeof c === 'object' && c !== null && (c as React.ReactElement)?.type === 'input'
    );
    if (hasCheckbox) {
      return (
        <li className="flex items-start gap-2 text-sm text-gh-text py-0.5" {...props}>{children}</li>
      );
    }
    return (
      <li className="flex items-start gap-2 text-sm text-gh-text py-0.5 before:content-['›'] before:text-gh-accent before:font-bold before:shrink-0 before:mt-px" {...props}>{children}</li>
    );
  },
  input: ({ type, checked }) => {
    if (type === 'checkbox') {
      return (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 mt-0.5 ${
          checked ? 'bg-gh-active border-gh-active text-white' : 'border-gh-border bg-gh-surface'
        }`}>
          {checked && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
        </span>
      );
    }
    return <input type={type} readOnly />;
  },
  code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
    inline ? (
      <code className="text-xs font-mono bg-gh-surface text-gh-accent px-1.5 py-0.5 rounded border border-gh-border/50">{children}</code>
    ) : (
      <code>{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-gh-surface border border-gh-border rounded-lg p-3 overflow-x-auto text-xs font-mono text-gh-text mb-3 leading-relaxed">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gh-accent/50 pl-3 text-gh-muted italic text-sm mb-3">{children}</blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gh-text">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-gh-accent hover:underline" target="_blank" rel="noreferrer">{children}</a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gh-surface">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-gh-muted font-medium border border-gh-border">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gh-text border border-gh-border">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-gh-surface/30">{children}</tr>,
  hr: () => <hr className="border-gh-border my-4" />,
};

type SessionDetailView = 'main' | 'plan' | 'todos' | 'threads' | 'artifacts' | 'session-db';

const DETAIL_VIEW_OPTIONS: Array<{ value: SessionDetailView; label: string }> = [
  { value: 'main', label: 'Main session' },
  { value: 'plan', label: 'Plan' },
  { value: 'todos', label: 'Todos' },
  { value: 'threads', label: 'Sub-agent threads' },
  { value: 'artifacts', label: 'Artifact views' },
  { value: 'session-db', label: 'Session DB' },
];

const DEFAULT_DB_PREVIEW_LIMIT = 50;
const ARTIFACT_GROUP_ORDER: Array<SessionArtifactGroup['path']> = ['plan.md', 'checkpoints', 'research'];

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
        <Markdown remarkPlugins={[remarkGfm]} components={planComponents}>{content}</Markdown>
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

  const pending   = todos.filter((t) => t.status === 'pending');
  const active    = todos.filter((t) => t.status === 'in_progress');
  const blocked   = todos.filter((t) => t.status === 'blocked');
  const done      = todos.filter((t) => isDone(t.status));
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
  onViewChange,
  selectedThreadId,
  onThreadChange,
  subAgents,
}: {
  session: SessionDetailData;
  activeView: SessionDetailView;
  onViewChange: (view: SessionDetailView) => void;
  selectedThreadId: string;
  onThreadChange: (threadId: string) => void;
  subAgents: ActiveSubAgent[];
}) {
  const todos = session.todos ?? [];
  const hasPlan = session.hasPlan || Boolean(session.planContent);
  const activeTodos = todos.filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = todos.filter((todo) => todo.status === 'blocked').length;
  const completedTodos = todos.filter((todo) => isDone(todo.status)).length;
  const activeThread = subAgents.find((agent) => agent.toolCallId === selectedThreadId) ?? subAgents[0] ?? null;
  const viewOptions = DETAIL_VIEW_OPTIONS.filter((option) => {
    if (option.value === 'plan') {
      return hasPlan;
    }

    if (option.value === 'todos') {
      return todos.length > 0;
    }

    if (option.value === 'threads') {
      return subAgents.length > 0;
    }

    return true;
  });
  const selectedView = viewOptions.some((option) => option.value === activeView) ? activeView : 'main';

  const titleByView: Record<SessionDetailView, string> = {
    main: 'Main session',
    plan: 'Plan',
    todos: 'Todos',
    threads: 'Sub-agent threads',
    artifacts: 'Artifact views',
    'session-db': 'Session DB',
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
      : 'Sub-agent conversations grouped in a single panel.',
    artifacts: 'Plan, checkpoint, and research artifacts from the current session.',
    'session-db': 'Read-only schema and row preview for the session database.',
  };

  const badgeTextByView: Partial<Record<SessionDetailView, string>> = {
    main: session.isWorking ? 'Live' : session.isOpen ? 'Open' : 'Closed',
    plan: session.isPlanPending ? 'Needs review' : 'Captured',
    todos: todos.length > 0 ? `${completedTodos}/${todos.length} done` : undefined,
    threads: activeThread ? (activeThread.isCompleted ? 'Done' : 'Running') : undefined,
    artifacts: hasPlan ? 'Artifacts ready' : 'No plan content',
    'session-db': 'Read only',
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
    artifacts: 'border-gh-border bg-gh-bg/70 text-gh-muted',
    'session-db': 'border-gh-border bg-gh-bg/70 text-gh-muted',
  };

  return (
    <div className="shrink-0 border-b border-gh-border bg-gh-surface/40 px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p id="session-detail-panel-heading" className="text-sm font-semibold text-gh-text">{titleByView[selectedView]}</p>
            <p className="mt-1 text-xs leading-5 text-gh-muted">{descriptionByView[selectedView]}</p>
            <p className="mt-2 text-xs text-gh-muted/80">
              {selectedView === 'threads' && activeThread ? activeThread.agentDisplayName || activeThread.agentName : session.title}
            </p>
          </div>
          {badgeTextByView[selectedView] && (
            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${badgeClassByView[selectedView]}`}>
              {badgeTextByView[selectedView]}
            </span>
          )}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <BrowseSelect
            label="View"
            value={selectedView}
            onChange={(value) => onViewChange(value as SessionDetailView)}
            options={viewOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />

          {selectedView === 'threads' && subAgents.length > 0 ? (
            <BrowseSelect
              label="Thread"
              value={selectedThreadId || subAgents[0]?.toolCallId || ''}
              onChange={onThreadChange}
              options={subAgents.map((agent) => ({
                value: agent.toolCallId,
                label: agent.agentDisplayName || agent.agentName,
              }))}
            />
          ) : (
            <div className="hidden lg:block" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactEntryTree({ entry }: { entry: SessionArtifactEntry }) {
  const isFolder = entry.kind === 'directory';

  return (
    <li className="rounded-lg border border-gh-border/70 bg-gh-bg/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${isFolder ? 'bg-gh-accent/12 text-gh-accent' : 'bg-gh-border/70 text-gh-muted'}`}>
          {isFolder ? '▸' : '•'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-gh-text">{entry.name}</span>
            <span className="rounded-full border border-gh-border bg-gh-surface px-2 py-0.5 text-[11px] text-gh-muted">
              {isFolder ? 'folder' : 'file'}
            </span>
            <span className="text-[11px] text-gh-muted">
              {formatBytes(entry.sizeBytes)}
            </span>
          </div>
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
            <ArtifactEntryTree key={`${entry.path}/${child.name}`} entry={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ArtifactGroupCard({ group }: { group: SessionArtifactGroup }) {
  const entries = group.entries ?? [];

  return (
    <section className="rounded-xl border border-gh-border bg-gh-surface/30 p-4">
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

      {group.path === 'plan.md' && group.content ? (
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-gh-border bg-gh-bg/70 p-3 text-xs leading-relaxed text-gh-text">
          {truncateText(group.content, 600)}
        </pre>
      ) : null}

      {entries.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <ArtifactEntryTree key={entry.path} entry={entry} />
          ))}
        </ul>
      ) : group.path !== 'plan.md' ? (
        <p className="mt-3 text-xs text-gh-muted">No files found in this group.</p>
      ) : null}
    </section>
  );
}

function SessionArtifactsPanel({ artifacts }: { artifacts: SessionArtifacts }) {
  const orderedGroups = [artifacts.plan, ...artifacts.folders].filter(
    (group): group is SessionArtifactGroup => ARTIFACT_GROUP_ORDER.includes(group.path),
  );
  const groups = ARTIFACT_GROUP_ORDER
    .map((path) => orderedGroups.find((group) => group.path === path))
    .filter((group): group is SessionArtifactGroup => Boolean(group));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid gap-3">
        {groups.map((group) => (
          <ArtifactGroupCard key={group.path} group={group} />
        ))}
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
  const subAgents = useMemo(() => [...(session?.activeSubAgents ?? [])].reverse(), [session?.activeSubAgents]);
  const hasPlan = Boolean(session?.hasPlan || session?.planContent);
  const hasTodos = (session?.todos?.length ?? 0) > 0;
  const { artifacts, loading: artifactsLoading, error: artifactsError } = useSessionArtifacts(session?.id ?? '');
  const {
    inspection: sessionDbInspection,
    loading: sessionDbLoading,
    error: sessionDbError,
  } = useSessionDbInspection(session?.id ?? '', selectedDbTable, DEFAULT_DB_PREVIEW_LIMIT);

  useLayoutEffect(() => {
    setActiveView('main');
    setSelectedThreadId('');
    setSelectedDbTable('');
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

    if (!subAgents.some((agent) => agent.toolCallId === selectedThreadId)) {
      setSelectedThreadId(subAgents[0].toolCallId);
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

    return true;
  });
  const resolvedView = availableViews.some((option) => option.value === activeView) ? activeView : 'main';
  const selectedThread = subAgents.find((agent) => agent.toolCallId === selectedThreadId) ?? subAgents[0] ?? null;
  const activeMessages = resolvedView === 'threads'
    ? (session.subAgentMessages?.[selectedThread?.toolCallId ?? ''] ?? [])
    : session.messages;
  const detailPanelClassName = `flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-gh-bg/20 ${modeBorderClass(session.currentMode)}`;

  function handleViewChange(view: SessionDetailView) {
    setActiveView(view);
  }

  function handleThreadChange(threadId: string) {
    setSelectedThreadId(threadId);
    setActiveView('threads');
  }

  return (
    <div className="grid h-full w-full min-h-0 gap-3 xl:grid-cols-[minmax(24rem,1.15fr)_minmax(34rem,1.65fr)_minmax(20rem,1fr)] 2xl:grid-cols-[minmax(26rem,1.2fr)_minmax(36rem,1.75fr)_minmax(22rem,1fr)] xl:gap-4">
      <section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-gh-border bg-gh-surface/20 p-4">
        <SessionMeta session={session} />
      </section>

      <section className={detailPanelClassName} aria-labelledby="session-detail-panel-heading">
        <DetailPanelHeader
          session={session}
          activeView={resolvedView}
          onViewChange={handleViewChange}
          selectedThreadId={selectedThread?.toolCallId ?? selectedThreadId}
          onThreadChange={handleThreadChange}
          subAgents={subAgents}
        />

        <div className="flex min-h-0 flex-1 flex-col" role="region" aria-labelledby="session-detail-panel-heading">
          {resolvedView === 'main' && (
            <MessageList messages={activeMessages} />
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
              <MessageList messages={activeMessages} />
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                  No sub-agent threads were captured for this session.
                </div>
              </div>
            )
          )}

          {resolvedView === 'artifacts' && (
            <div className="flex-1 min-h-0 flex flex-col">
              {artifactsLoading && !artifacts && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    Loading artifact files…
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
              {artifacts && <SessionArtifactsPanel artifacts={artifacts} />}
              {!artifactsLoading && !artifactsError && !artifacts && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    No artifact data was returned for this session.
                  </div>
                </div>
              )}
            </div>
          )}

          {resolvedView === 'session-db' && (
            <div className="flex-1 min-h-0 flex flex-col">
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
              {sessionDbInspection && sessionDbInspection.availableTables.length > 0 && (
                <SessionDbInspector
                  inspection={sessionDbInspection}
                  selectedTable={selectedDbTable}
                  onTableChange={setSelectedDbTable}
                  limit={DEFAULT_DB_PREVIEW_LIMIT}
                />
              )}
              {!sessionDbLoading && !sessionDbError && sessionDbInspection && sessionDbInspection.availableTables.length === 0 && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="rounded-xl border border-gh-border bg-gh-surface/30 p-4 text-sm text-gh-muted">
                    No tables were found in the session database.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <SessionSidebar currentId={id ?? ''} currentProjectPath={session.projectPath} sessions={sessions} />
    </div>
  );
}
