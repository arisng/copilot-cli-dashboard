import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MessagePreview, SessionSummary, ActiveSubAgent } from '../../api/client.ts';
import {
  DEFAULT_SESSION_BROWSE_STATE,
  SESSION_BROWSE_SORT_FIELDS,
  SESSION_BROWSE_STATUS_OPTIONS,
  filterSessionsForBrowse,
  getProjectLabel,
  getSessionBrowseStatus,
  useSessionBrowse,
  type SessionBrowseSortOrder,
  type SessionBrowseState,
  type SessionBrowseStatus,
} from '../../hooks/useSessionBrowse.ts';
import { useSessions } from '../../hooks/useSessions.ts';
import {
  BrowsePagination,
  BrowseSelect,
  BrowseSortOrderToggle,
  SESSION_BROWSE_SORT_FIELD_LABELS,
} from '../shared/SessionBrowseControls.tsx';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { getSessionErrorLabel } from '../../utils/sessionError.ts';
import { MobileInfoCard } from './MobileInfoCard.tsx';
import { getMobileSessionState } from './mobileSessionState.ts';

type MobileListGroupId = 'priority' | 'working' | 'quiet';
type SignalTone = 'attention' | 'active' | 'muted';

interface SessionSignal {
  label: string;
  tone: SignalTone;
}

interface SessionCardModel {
  session: SessionSummary;
  state: ReturnType<typeof getMobileSessionState>;
  projectName: string;
  latestPreview?: MessagePreview;
  activeAgentCount: number;
  activeAgents: ActiveSubAgent[];
  isPriority: boolean;
  isWorkingBucket: boolean;
  signals: SessionSignal[];
}

interface SessionGroup {
  id: MobileListGroupId;
  title: string;
  description: string;
  sessions: SessionCardModel[];
}

const RECENT_ACTIVITY_WINDOW_MS = 15 * 60 * 1000;
const MOBILE_PAGE_SIZE = 6;

const SECTION_METADATA: Omit<SessionGroup, 'sessions'>[] = [
  {
    id: 'priority',
    title: 'Priority now',
    description: 'Waiting on you first, or worth checking before quieter threads.',
  },
  {
    id: 'working',
    title: 'Active now',
    description: 'Working sessions, recent updates, or live agent activity from the last 15 minutes.',
  },
  {
    id: 'quiet',
    title: 'Quiet open',
    description: 'Still open, but not actively moving right now.',
  },
];

// Tool metadata matching desktop SessionCard.tsx
const TOOL_META: Record<string, { label: string; dot: string; text: string; border: string }> = {
  bash:          { label: 'bash',       dot: 'bg-blue-400',    text: 'text-blue-400',    border: 'border-blue-400/30' },
  edit:          { label: 'edit',       dot: 'bg-yellow-400',  text: 'text-yellow-400',  border: 'border-yellow-400/30' },
  view:          { label: 'read',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  read:          { label: 'read',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  glob:          { label: 'glob',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  grep:          { label: 'grep',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  write:         { label: 'write',      dot: 'bg-orange-400',  text: 'text-orange-400',  border: 'border-orange-400/30' },
  task:          { label: 'agent',      dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  task_complete: { label: 'agent',      dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  read_agent:    { label: 'read agent', dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  ask_user:      { label: 'question',   dot: 'bg-pink-400',    text: 'text-pink-400',    border: 'border-pink-400/30' },
  report_intent: { label: 'intent',     dot: 'bg-gray-400',    text: 'text-gray-400',    border: 'border-gray-400/30' },
  web_fetch:     { label: 'web fetch',  dot: 'bg-gh-accent',   text: 'text-gh-accent',   border: 'border-gh-accent/30' },
  web_search:    { label: 'web search', dot: 'bg-gh-accent',   text: 'text-gh-accent',   border: 'border-gh-accent/30' },
};

const DEFAULT_TOOL_META = { label: '', dot: 'bg-gh-accent', text: 'text-gh-accent', border: 'border-gh-accent/30' };

function toolMeta(name: string) {
  if (TOOL_META[name]) return { ...TOOL_META[name] };
  if (name.startsWith('mcp-atlassian-confluence')) return { label: 'confluence', dot: 'bg-blue-400', text: 'text-blue-400', border: 'border-blue-400/30' };
  if (name.startsWith('mcp-atlassian-jira'))       return { label: 'jira',       dot: 'bg-indigo-400', text: 'text-indigo-400', border: 'border-indigo-400/30' };
  return { ...DEFAULT_TOOL_META, label: name.replace(/_/g, ' ') };
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M5.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06L8.94 8 5.22 4.28a.75.75 0 010-1.06z" />
    </svg>
  );
}

function CopyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className={className}>
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className={className}>
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 011.06-1.06L6 10.94l7.22-7.22a.75.75 0 011.06 0z"/>
    </svg>
  );
}

function SectionHeader({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="px-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gh-text">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gh-muted">{description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-gh-border bg-gh-bg px-2.5 py-1 text-[11px] font-medium text-gh-muted">
          {count}
        </span>
      </div>
    </div>
  );
}

const signalToneClasses: Record<SignalTone, string> = {
  attention: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
  active: 'border-gh-active/30 bg-gh-active/10 text-gh-active',
  muted: 'border-gh-border/70 bg-gh-bg/80 text-gh-muted',
};

function SessionSignalChip({ label, tone }: SessionSignal) {
  return (
    <span
      className={`inline-flex min-h-[28px] items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${signalToneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function ToolChip({ name, count }: { name: string; count?: number }) {
  const meta = toolMeta(name);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${meta.border} bg-gh-bg`}>
      <span className={`w-1 h-1 rounded-full shrink-0 ${meta.dot}`} />
      <span className={meta.text}>{meta.label}</span>
      {count && count > 1 && <span className="text-gh-muted">×{count}</span>}
    </span>
  );
}

function CopyBranch({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);
  
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(branch).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copy branch name"
      aria-label={`Copy branch name ${branch}`}
      className="inline-flex h-[22px] min-w-[44px] items-center justify-center gap-1 rounded-full border border-gh-accent/20 bg-gh-accent/5 px-2 text-[10px] font-mono text-gh-accent transition-colors hover:border-gh-accent/40 hover:bg-gh-accent/10 hover:text-gh-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 active:scale-95"
    >
      <span className="truncate max-w-[80px]">{branch}</span>
      <span className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100">
        {copied ? <CheckIcon className="text-gh-active" /> : <CopyIcon />}
      </span>
    </button>
  );
}

function ModelChip({ model }: { model: string }) {
  // Truncate long model names for mobile
  const displayModel = model.length > 20 ? model.slice(0, 18) + '…' : model;
  
  return (
    <span 
      className="inline-flex h-[22px] max-w-[120px] items-center truncate rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 text-[10px] font-mono text-gh-muted"
      title={model}
    >
      {displayModel}
    </span>
  );
}

function ActiveAgentPill({ agent }: { agent: ActiveSubAgent }) {
  return (
    <span className="inline-flex h-[24px] items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 text-[10px] font-mono text-gh-accent">
      <span className="w-1 h-1 rounded-full bg-gh-active animate-pulse" />
      <span className="truncate max-w-[80px]">{agent.agentDisplayName || agent.agentName}</span>
    </span>
  );
}

function getActiveAgentCount(session: SessionSummary): number {
  return session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
}

function getActiveAgents(session: SessionSummary): ActiveSubAgent[] {
  return session.activeSubAgents.filter((agent) => !agent.isCompleted);
}

function getLatestPreview(session: SessionSummary): MessagePreview | undefined {
  const previews = session.previewMessages ?? [];
  return previews[previews.length - 1];
}

function isPrioritySession(session: SessionSummary): boolean {
  return session.needsAttention || Boolean(session.lastError) || session.isPlanPending || session.isTaskComplete || session.isAborted;
}

function getActivityTime(lastActivityAt: string): number {
  const activityTime = Date.parse(lastActivityAt);
  return Number.isNaN(activityTime) ? 0 : activityTime;
}

function isRecentlyActive(lastActivityAt: string, now: number): boolean {
  return now - getActivityTime(lastActivityAt) <= RECENT_ACTIVITY_WINDOW_MS;
}

function hasVisibleConversation(session: SessionSummary): boolean {
  return session.messageCount > 0 || (session.previewMessages?.length ?? 0) > 0;
}

function getSessionSignals(session: SessionSummary, activeAgentCount: number): SessionSignal[] {
  const signals: SessionSignal[] = [];

  if (session.isPlanPending) {
    signals.push({ label: 'Plan review', tone: 'attention' });
  }

  if (session.lastError) {
    signals.push({ label: getSessionErrorLabel(session.lastError), tone: 'attention' });
  }

  if (activeAgentCount > 0) {
    signals.push({
      label: `${activeAgentCount} active agent${activeAgentCount === 1 ? '' : 's'}`,
      tone: 'active',
    });
  }

  if (session.isTaskComplete && !session.needsAttention) {
    signals.push({ label: 'Ready to inspect', tone: 'active' });
  }

  if (session.isAborted) {
    signals.push({ label: 'Stopped early', tone: 'muted' });
  }

  if (signals.length === 0 && session.isIdle) {
    signals.push({ label: 'Quiet', tone: 'muted' });
  }

  return signals;
}

function buildSessionCardModel(session: SessionSummary, now: number): SessionCardModel {
  const activeAgents = getActiveAgents(session);
  const activeAgentCount = activeAgents.length;
  const isPriority = isPrioritySession(session);
  const hasConversation = hasVisibleConversation(session);
  const isWorkingBucket =
    !isPriority &&
    (session.isWorking ||
      activeAgentCount > 0 ||
      (hasConversation && isRecentlyActive(session.lastActivityAt, now)));

  return {
    session,
    state: getMobileSessionState(session),
    projectName: getProjectLabel(session.projectPath),
    latestPreview: getLatestPreview(session),
    activeAgentCount,
    activeAgents,
    isPriority,
    isWorkingBucket,
    signals: getSessionSignals(session, activeAgentCount),
  };
}

function createSessionGroups(items: SessionCardModel[]): SessionGroup[] {
  const groupedSessions: Record<MobileListGroupId, SessionCardModel[]> = {
    priority: [],
    working: [],
    quiet: [],
  };

  for (const item of items) {
    if (item.isPriority) {
      groupedSessions.priority.push(item);
      continue;
    }

    if (item.isWorkingBucket) {
      groupedSessions.working.push(item);
      continue;
    }

    groupedSessions.quiet.push(item);
  }

  return SECTION_METADATA.map((section) => ({
    ...section,
    sessions: groupedSessions[section.id],
  }));
}

function SessionPreviewCard({ item }: { item: SessionCardModel }) {
  const { session, state, projectName, latestPreview, activeAgentCount, activeAgents, signals } = item;
  
  const previewMetrics = [
    { label: 'Duration', value: formatDuration(session.durationMs) },
    { label: 'Messages', value: session.messageCount },
    { label: 'Agents', value: activeAgentCount },
  ];
  
  const cardClassName = session.needsAttention || session.isPlanPending
    ? 'border-gh-attention/40 bg-gh-attention/5 hover:border-gh-attention/60'
    : session.lastError
      ? 'border-gh-warning/40 bg-gh-warning/5 hover:border-gh-warning/60'
    : session.isTaskComplete
      ? 'border-emerald-400/30 bg-emerald-400/5 hover:border-emerald-400/45'
      : session.isWorking || activeAgentCount > 0
        ? 'border-gh-active/30 bg-gh-active/5 hover:border-gh-active/45'
        : session.isAborted
          ? 'border-red-500/25 bg-red-500/5 hover:border-red-500/40'
          : 'border-gh-border bg-gh-surface/90 hover:border-gh-accent/30 hover:bg-gh-surface';

  // Generate tool chips from latest preview (deduplicated by label)
  const toolChips = useMemo(() => {
    if (!latestPreview?.toolNames || latestPreview.toolNames.length === 0) return [];
    
    const counts = new Map<string, { name: string; count: number }>();
    for (const name of latestPreview.toolNames) {
      const label = toolMeta(name).label;
      const existing = counts.get(label);
      if (existing) existing.count++;
      else counts.set(label, { name, count: 1 });
    }
    return [...counts.values()].slice(0, 3);
  }, [latestPreview?.toolNames]);
  
  const overflowCount = latestPreview?.toolNames 
    ? Math.max(0, (() => {
        const uniqueLabels = new Set(latestPreview.toolNames!.map(name => toolMeta(name).label));
        return uniqueLabels.size - 3;
      })())
    : 0;

  return (
    <Link
      to={`/m/sessions/${session.id}`}
      className={`group block rounded-[26px] border p-4 shadow-sm transition-colors active:scale-[0.99] ${cardClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${state.className}`}>
              {state.label}
            </span>
            <ModeBadge mode={session.currentMode} />
            {session.model && <ModelChip model={session.model} />}
          </div>

          <h3 className="mt-3 text-base font-semibold leading-snug text-gh-text">{session.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs leading-relaxed text-gh-muted">{projectName}</span>
            {session.gitBranch && (
              <>
                <span className="text-gh-muted">·</span>
                <CopyBranch branch={session.gitBranch} />
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <RelativeTime timestamp={session.lastActivityAt} className="text-xs text-gh-muted" />
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gh-border/70 bg-gh-bg/80 text-gh-muted transition-colors group-hover:border-gh-accent/40 group-hover:text-gh-text">
            <ChevronRightIcon />
          </span>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {signals.map((signal) => (
            <SessionSignalChip key={`${session.id}-${signal.label}`} {...signal} />
          ))}
        </div>
      )}

      {/* Active agent pills - show up to 2 when there are active agents */}
      {activeAgents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {activeAgents.slice(0, 2).map((agent) => (
            <ActiveAgentPill key={agent.toolCallId} agent={agent} />
          ))}
          {activeAgents.length > 2 && (
            <span className="inline-flex h-[24px] items-center rounded-full border border-gh-border/70 bg-gh-bg/50 px-2 text-[10px] text-gh-muted">
              +{activeAgents.length - 2} more
            </span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {previewMetrics.map((metric) => (
          <MobileInfoCard key={metric.label} label={metric.label} value={metric.value} variant="subtle" />
        ))}
      </div>

      {latestPreview && (
        <div className="mt-3 rounded-2xl border border-gh-border/70 bg-gh-bg/70 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-gh-muted">
              Latest {latestPreview.role}
            </p>
            {toolChips.length > 0 && (
              <div className="flex items-center gap-1">
                {toolChips.map(({ name, count }) => (
                  <ToolChip key={name} name={name} count={count} />
                ))}
                {overflowCount > 0 && (
                  <span className="text-[10px] text-gh-muted">+{overflowCount}</span>
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-gh-text line-clamp-3">{latestPreview.snippet}</p>
        </div>
      )}
    </Link>
  );
}

export function MobileSessionList() {
  const { sessions, loading, error } = useSessions();
  const [browseState, setBrowseState] = useState<SessionBrowseState>(() => ({
    ...DEFAULT_SESSION_BROWSE_STATE,
    pageSize: MOBILE_PAGE_SIZE,
  }));

  const browse = useSessionBrowse(sessions, browseState);

  const filteredSessionModels = useMemo(() => {
    const now = Date.now();
    return browse.filteredSessions.map((session) => buildSessionCardModel(session, now));
  }, [browse.filteredSessions]);

  const paginatedSessionIds = useMemo(
    () => new Set(browse.paginatedSessions.map((session) => session.id)),
    [browse.paginatedSessions],
  );

  const visibleSessionModels = useMemo(
    () => filteredSessionModels.filter((item) => paginatedSessionIds.has(item.session.id)),
    [filteredSessionModels, paginatedSessionIds],
  );

  const filteredSections = useMemo(
    () => createSessionGroups(filteredSessionModels),
    [filteredSessionModels],
  );

  const visibleSections = useMemo(
    () => createSessionGroups(visibleSessionModels).filter((section) => section.sessions.length > 0),
    [visibleSessionModels],
  );

  const prioritySessions = filteredSections[0]?.sessions ?? [];
  const workingSessions = filteredSections[1]?.sessions ?? [];
  const quietSessions = filteredSections[2]?.sessions ?? [];

  const attentionCount = filteredSessionModels.filter((item) => item.session.needsAttention || item.session.lastError).length;
  const planPendingCount = filteredSessionModels.filter((item) => item.session.isPlanPending).length;
  const completedCount = filteredSessionModels.filter((item) => item.session.isTaskComplete).length;
  const activeAgentTotal = filteredSessionModels.reduce((total, item) => total + item.activeAgentCount, 0);

  const statusScopeSessions = useMemo(
    () =>
      filterSessionsForBrowse(sessions, {
        projectPath: browse.projectPath,
        branch: browse.branch,
        status: null,
        query: browseState.query ?? '',
      }),
    [browse.branch, browse.projectPath, browseState.query, sessions],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<SessionBrowseStatus, number> = {
      'Needs attention': 0,
      Working: 0,
      'Task complete': 0,
      Idle: 0,
    };

    for (const session of statusScopeSessions) {
      const status = getSessionBrowseStatus(session);
      if (status) {
        counts[status] += 1;
      }
    }

    return counts;
  }, [statusScopeSessions]);

  const hasCustomBrowse =
    browse.projectPath !== null ||
    browse.branch !== null ||
    browse.status !== null ||
    browseState.sortField !== DEFAULT_SESSION_BROWSE_STATE.sortField ||
    browseState.sortOrder !== DEFAULT_SESSION_BROWSE_STATE.sortOrder;

  const projectOptions = [
    { value: '', label: 'All projects' },
    ...browse.projectOptions.map((option) => ({
      value: option.value,
      label: `${option.label} (${option.count})`,
    })),
  ];
  const branchOptions = [
    { value: '', label: browse.projectPath ? 'All branches' : 'Select project first' },
    ...browse.branchOptions.map((option) => ({
      value: option.value,
      label: `${option.label} (${option.count})`,
    })),
  ];
  const statusOptions = [
    { value: '', label: `All statuses (${statusScopeSessions.length})` },
    ...SESSION_BROWSE_STATUS_OPTIONS.map((status) => ({
      value: status,
      label: `${status} (${statusCounts[status]})`,
    })),
  ];
  const sortOptions = SESSION_BROWSE_SORT_FIELDS.map((field) => ({
    value: field,
    label: SESSION_BROWSE_SORT_FIELD_LABELS[field],
  }));

  function resetBrowse() {
    setBrowseState({
      ...DEFAULT_SESSION_BROWSE_STATE,
      pageSize: MOBILE_PAGE_SIZE,
    });
  }

  function handleProjectChange(value: string) {
    setBrowseState((current) => ({
      ...current,
      projectPath: value || null,
      branch: null,
      page: 1,
    }));
  }

  function handleBranchChange(value: string) {
    setBrowseState((current) => ({
      ...current,
      branch: value || null,
      page: 1,
    }));
  }

  function handleStatusChange(value: string) {
    setBrowseState((current) => ({
      ...current,
      status: (value || null) as SessionBrowseStatus | null,
      page: 1,
    }));
  }

  function handleSortFieldChange(value: string) {
    setBrowseState((current) => ({
      ...current,
      sortField: value as typeof current.sortField,
      page: 1,
    }));
  }

  function handleSortOrderChange(value: SessionBrowseSortOrder) {
    setBrowseState((current) => ({
      ...current,
      sortOrder: value,
      page: 1,
    }));
  }

  function handlePageChange(page: number) {
    setBrowseState((current) => ({
      ...current,
      page,
    }));
  }

  const heroTitle =
    browse.totalItems === 0
      ? 'No matching open sessions'
      : prioritySessions.length > 0
      ? `${prioritySessions.length} session${prioritySessions.length === 1 ? ' is' : 's are'} worth checking first`
      : workingSessions.length > 0
        ? `${workingSessions.length} session${workingSessions.length === 1 ? ' is' : 's are'} actively moving`
        : filteredSessionModels.length > 0
          ? 'No urgent movement right now'
          : 'No open sessions yet';

  const heroDetails = [
    attentionCount > 0 ? `${attentionCount} need attention` : null,
    planPendingCount > 0 ? `${planPendingCount} plan review` : null,
    completedCount > 0 ? `${completedCount} complete` : null,
    activeAgentTotal > 0 ? `${activeAgentTotal} active agent${activeAgentTotal === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  const overviewMetrics = [
    { label: 'Open', value: filteredSessionModels.length },
    { label: 'Priority', value: prioritySessions.length },
    { label: 'Active', value: workingSessions.length },
    { label: 'Quiet', value: quietSessions.length },
  ];

  return (
    <section data-testid="mobile-session-list" className="space-y-4">
      <div className="rounded-[28px] border border-gh-border bg-gradient-to-br from-gh-surface via-gh-surface to-gh-bg p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-gh-accent/80">Mobile overview</p>
            <h2 className="mt-2 text-xl font-semibold text-gh-text">Sessions</h2>
          </div>
          <span className="shrink-0 rounded-full border border-gh-active/30 bg-gh-active/10 px-3 py-1.5 text-[11px] font-medium text-gh-active">
            Live · 5s
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-gh-muted">
          Scan what needs you first, then jump straight into the live thread that matters most.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {overviewMetrics.map((metric) => (
            <MobileInfoCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              valueClassName="text-lg font-semibold text-gh-text"
            />
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-gh-border/70 bg-gh-bg/70 p-3.5">
          <p className="text-sm font-semibold text-gh-text">{heroTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-gh-muted">
            {heroDetails.length > 0
              ? heroDetails.join(' · ')
              : 'Auto-refresh keeps this view current every 5 seconds.'}
          </p>
        </div>

        <div className="mt-4 rounded-[24px] border border-gh-border/70 bg-gh-bg/65 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gh-text">Browse open sessions</p>
              <p className="mt-1 text-xs leading-relaxed text-gh-muted">
                Filter by project, branch, or status, then sort and page through the matching sessions.
              </p>
            </div>
            {hasCustomBrowse ? (
              <button
                type="button"
                onClick={resetBrowse}
                className="h-8 min-w-[44px] shrink-0 rounded-full border border-gh-border bg-gh-bg px-3 text-[11px] font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            <BrowseSelect
              label="Project"
              value={browse.projectPath ?? ''}
              onChange={handleProjectChange}
              options={projectOptions}
              size="mobile"
            />

            <BrowseSelect
              label="Branch"
              value={browse.branch ?? ''}
              disabled={!browse.projectPath}
              onChange={handleBranchChange}
              options={branchOptions}
              size="mobile"
            />

            <BrowseSelect
              label="Status"
              value={browse.status ?? ''}
              onChange={handleStatusChange}
              options={statusOptions}
              size="mobile"
            />

            <BrowseSelect
              label="Sort field"
              value={browseState.sortField}
              onChange={handleSortFieldChange}
              options={sortOptions}
              size="mobile"
            />
          </div>

          <div className="mt-4">
            <BrowseSortOrderToggle value={browseState.sortOrder} onChange={handleSortOrderChange} size="mobile" />
          </div>

          {browse.totalItems > 0 ? (
            <div className="mt-4 rounded-2xl border border-gh-border/70 bg-gh-surface/85 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gh-text">
                    {browse.totalItems} matching session{browse.totalItems === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-gh-muted">
                    Grouped page cards stay in priority, active, and quiet sections.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-gh-border bg-gh-bg px-2.5 py-1 text-[11px] font-medium text-gh-muted">
                  {browse.page}/{browse.totalPages}
                </span>
              </div>

              <div className="mt-3">
                <BrowsePagination
                  page={browse.page}
                  totalPages={browse.totalPages}
                  totalItems={browse.totalPages}
                  pageSize={browse.pageSize}
                  onPageChange={handlePageChange}
                  size="mobile"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading && sessions.length === 0 && <LoadingSpinner />}

      {error && (
        <div className="rounded-2xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      )}

      {!loading && sessions.length === 0 && !error && (
        <div className="rounded-2xl border border-gh-border bg-gh-surface p-6 text-center">
          <p className="text-sm text-gh-text">No sessions yet.</p>
          <p className="mt-2 text-xs text-gh-muted">
            Start a Copilot CLI session and it will appear here automatically.
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        browse.totalItems > 0 ? (
          <div className="space-y-5">
            {visibleSections.map((section) => (
              <div key={section.id} className="space-y-3">
                <SectionHeader
                  title={section.title}
                  description={section.description}
                  count={section.sessions.length}
                />
                <div className="space-y-3">
                  {section.sessions.map((item) => (
                    <SessionPreviewCard key={item.session.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gh-border bg-gh-surface p-6 text-center">
            <p className="text-sm text-gh-text">No sessions match these browse controls right now.</p>
            <button
              type="button"
              onClick={resetBrowse}
              className="mt-3 inline-flex h-10 min-w-[44px] items-center rounded-full border border-gh-border bg-gh-bg px-3 text-sm font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40"
            >
              Reset browse
            </button>
          </div>
        )
      )}
    </section>
  );
}
