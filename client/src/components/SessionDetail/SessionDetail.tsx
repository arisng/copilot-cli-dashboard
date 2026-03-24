import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  BrowseToggle,
  SESSION_BROWSE_SORT_FIELD_LABELS,
} from '../shared/SessionBrowseControls.tsx';
import { SessionMeta } from './SessionMeta.tsx';
import {
  SessionTabNav,
  type SessionDetailTab,
  getSessionDetailPanelId,
  getSessionDetailTabId,
} from './SessionTabNav.tsx';
import { modeBorderClass } from '../shared/modeBadge.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { RelativeTime } from '../shared/RelativeTime.tsx';
import type { ParsedMessage, SessionDetail as SessionDetailData, SessionSummary, TodoItem } from '../../api/client.ts';

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

function DetailPanelHeader({ tab, session }: { tab: SessionDetailTab; session: SessionDetailData }) {
  const todos = session.todos ?? [];
  const activeTodos = todos.filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = todos.filter((todo) => todo.status === 'blocked').length;
  const doneTodos = todos.filter((todo) => isDone(todo.status)).length;
  const activeAgent = tab.agent;

  let subtitle = tab.description ?? 'Primary conversation, tool calls, and completion updates.';
  let meta = `${pluralize(session.messageCount, 'message')} in the main session thread`;
  let badgeLabel: string | null = session.isWorking ? 'Live' : null;
  let badgeClass = 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent';

  if (tab.isPlan) {
    subtitle = session.isPlanPending
      ? 'Review the captured plan before execution continues.'
      : 'Captured plan artifact saved from this session.';
    meta = session.isPlanPending ? 'Approval is still pending in the CLI.' : 'Plan content is available for reference.';
    badgeLabel = session.isPlanPending ? 'Needs review' : 'Captured';
    badgeClass = session.isPlanPending
      ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention'
      : 'border-gh-border bg-gh-bg/70 text-gh-muted';
  } else if (tab.isTodos) {
    subtitle = 'Tracked work items grouped by progress, blockers, and completed tasks.';
    meta = todos.length > 0
      ? `${pluralize(activeTodos, 'active todo')} · ${pluralize(blockedTodos, 'blocked todo')} · ${doneTodos}/${todos.length} done`
      : 'No todos are recorded for this session yet.';
    badgeLabel = todos.length > 0 ? `${doneTodos}/${todos.length} done` : null;
    badgeClass = 'border-gh-active/30 bg-gh-active/10 text-gh-active';
  } else if (activeAgent) {
    subtitle = activeAgent.description || 'Sub-agent conversation and tool activity.';
    meta = activeAgent.agentDisplayName || activeAgent.agentName;
    badgeLabel = activeAgent.isCompleted ? 'Done' : 'Running';
    badgeClass = activeAgent.isCompleted
      ? 'border-gh-border bg-gh-bg/70 text-gh-muted'
      : 'border-gh-active/30 bg-gh-active/10 text-gh-active';
  }

  return (
    <div className="shrink-0 border-b border-gh-border bg-gh-surface/40 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gh-text">{tab.label}</p>
          <p className="mt-1 text-xs leading-5 text-gh-muted">{subtitle}</p>
          <p className="mt-2 text-xs text-gh-muted/80">{meta}</p>
        </div>
        {badgeLabel && (
          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${badgeClass}`}>
            {badgeLabel}
          </span>
        )}
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
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => { setActiveTab('main'); }, [id]);

  useEffect(() => {
    if (!session?.isPlanPending) return;

    setActiveTab((currentTab) => {
      const selectedTabStillExists = currentTab === 'main'
        || currentTab === 'plan'
        || currentTab === 'todos'
        || session.activeSubAgents.some((agent) => agent.toolCallId === currentTab);

      if (currentTab === 'main' || !selectedTabStillExists) {
        return 'plan';
      }

      return currentTab;
    });
  }, [session?.activeSubAgents, session?.id, session?.isPlanPending]);

  if (loading && !session) return <LoadingSpinner />;
  if (error) return (
    <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">{error}</div>
  );
  if (!session) return null;

  const subAgents = [...(session.activeSubAgents ?? [])].reverse(); // newest first
  const hasPlan = !!session.planContent;
  const hasTodos = (session.todos?.length ?? 0) > 0;
  const tabs: SessionDetailTab[] = [
    {
      id: 'main',
      label: 'Main session',
      description: `${pluralize(session.messageCount, 'message')} in the primary conversation.`,
      isMain: true,
      isSubAgent: false,
    },
    ...(hasPlan ? [{
      id: 'plan',
      label: 'Plan',
      description: session.isPlanPending ? 'Review before execution continues.' : 'Captured plan artifact.',
      isSubAgent: false,
      isPlan: true,
      isPlanPending: session.isPlanPending,
    }] : []),
    ...(hasTodos ? [{
      id: 'todos',
      label: 'Todos',
      description: `${pluralize(session.todos?.length ?? 0, 'tracked item')}.`,
      isSubAgent: false,
      isTodos: true,
    }] : []),
    ...subAgents.map((a) => {
      const isCodeReview = a.agentName === 'code-review' || a.agentName === 'code-reviewer';
      const isRead = a.agentName === 'read_agent';
      const label = isRead
        ? `Read · ${a.agentDisplayName || a.description || 'Agent'}`
        : (a.agentDisplayName || a.agentName);
      return {
        id: a.toolCallId,
        label,
        description: a.description || (a.isCompleted ? 'Completed thread' : 'Active thread'),
        isCompleted: a.isCompleted,
        isSubAgent: true,
        agent: a,
        accentColor: isCodeReview ? ('sky' as const) : ('blue' as const),
      };
    }),
  ];

  const resolvedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'main';
  const activeTabDefinition = tabs.find((tab) => tab.id === resolvedActiveTab) ?? tabs[0];
  const activeMessages = resolvedActiveTab === 'main'
    ? session.messages
    : (session.subAgentMessages?.[resolvedActiveTab] ?? []);
  const panelAccessibilityProps = { 'aria-labelledby': getSessionDetailTabId(resolvedActiveTab) };
  const detailPanelClassName = `flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-gh-bg/20 ${modeBorderClass(session.currentMode)}`;

  return (
    <div className="grid h-full w-full min-h-0 gap-3 xl:grid-cols-[minmax(24rem,1.15fr)_minmax(34rem,1.65fr)_minmax(20rem,1fr)] 2xl:grid-cols-[minmax(26rem,1.2fr)_minmax(36rem,1.75fr)_minmax(22rem,1fr)] xl:gap-4">
      <section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-gh-border bg-gh-surface/20 p-4">
        <SessionMeta session={session} />
      </section>

      <section className="grid min-w-0 min-h-0 w-full gap-4 xl:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
        <aside className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-gh-border bg-gh-surface/35 p-3">
          <SessionTabNav tabs={tabs} activeId={resolvedActiveTab} onChange={setActiveTab} />
        </aside>

        <div className={detailPanelClassName}>
          <DetailPanelHeader tab={activeTabDefinition} session={session} />

          <div
            id={getSessionDetailPanelId(resolvedActiveTab)}
            role="tabpanel"
            className="flex-1 min-h-0 flex flex-col"
            {...panelAccessibilityProps}
          >
            {resolvedActiveTab === 'plan' && session.planContent && (
              <PlanView content={session.planContent} isPending={session.isPlanPending} />
            )}

            {resolvedActiveTab === 'todos' && session.todos && (
              <TodosView todos={session.todos} />
            )}

            {resolvedActiveTab !== 'plan' && resolvedActiveTab !== 'todos' && (
              <MessageList messages={activeMessages} />
            )}
          </div>
        </div>
      </section>

      <SessionSidebar currentId={id ?? ''} currentProjectPath={session.projectPath} sessions={sessions} />
    </div>
  );
}
