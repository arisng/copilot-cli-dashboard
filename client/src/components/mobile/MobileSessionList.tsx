import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MessagePreview, SessionSummary } from '../../api/client.ts';
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

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M5.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 11-1.06-1.06L8.94 8 5.22 4.28a.75.75 0 010-1.06z" />
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

function getActiveAgentCount(session: SessionSummary): number {
  return session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
}

function getLatestPreview(session: SessionSummary): MessagePreview | undefined {
  const previews = session.previewMessages ?? [];
  return previews[previews.length - 1];
}

function isPrioritySession(session: SessionSummary): boolean {
  return session.needsAttention || session.isPlanPending || session.isTaskComplete || session.isAborted;
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
  const activeAgentCount = getActiveAgentCount(session);
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
  const { session, state, projectName, latestPreview, activeAgentCount, signals } = item;
  const previewMetrics = [
    { label: 'Duration', value: formatDuration(session.durationMs) },
    { label: 'Messages', value: session.messageCount },
    { label: 'Agents', value: activeAgentCount },
  ];
  const cardClassName = session.needsAttention || session.isPlanPending
    ? 'border-gh-attention/40 bg-gh-attention/5 hover:border-gh-attention/60'
    : session.isTaskComplete
      ? 'border-emerald-400/30 bg-emerald-400/5 hover:border-emerald-400/45'
      : session.isWorking || activeAgentCount > 0
        ? 'border-gh-active/30 bg-gh-active/5 hover:border-gh-active/45'
        : session.isAborted
          ? 'border-red-500/25 bg-red-500/5 hover:border-red-500/40'
          : 'border-gh-border bg-gh-surface/90 hover:border-gh-accent/30 hover:bg-gh-surface';

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
          </div>

          <h3 className="mt-3 text-base font-semibold leading-snug text-gh-text">{session.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gh-muted">
            {projectName}
            {session.gitBranch ? <span> · {session.gitBranch}</span> : null}
          </p>
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
            {latestPreview.toolNames && latestPreview.toolNames.length > 0 ? (
              <span className="text-[11px] text-gh-muted">
                {latestPreview.toolNames.length} tool{latestPreview.toolNames.length === 1 ? '' : 's'}
              </span>
            ) : null}
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

  const openSessions = useMemo(
    () => sessions.filter((session) => session.isOpen),
    [sessions],
  );

  const browse = useSessionBrowse(openSessions, browseState);

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

  const attentionCount = filteredSessionModels.filter((item) => item.session.needsAttention).length;
  const planPendingCount = filteredSessionModels.filter((item) => item.session.isPlanPending).length;
  const completedCount = filteredSessionModels.filter((item) => item.session.isTaskComplete).length;
  const activeAgentTotal = filteredSessionModels.reduce((total, item) => total + item.activeAgentCount, 0);

  const statusScopeSessions = useMemo(
    () =>
      filterSessionsForBrowse(openSessions, {
        projectPath: browse.projectPath,
        branch: browse.branch,
        status: null,
        showUnknownContext: browseState.showUnknownContext,
      }),
    [browse.branch, browse.projectPath, browseState.showUnknownContext, openSessions],
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
                className="shrink-0 rounded-full border border-gh-border bg-gh-bg px-3 py-1.5 text-[11px] font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
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
                  totalItems={browse.totalItems}
                  pageSize={browse.pageSize}
                  onPageChange={handlePageChange}
                  size="mobile"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading && openSessions.length === 0 && <LoadingSpinner />}

      {error && (
        <div className="rounded-2xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      )}

      {!loading && openSessions.length === 0 && !error && (
        <div className="rounded-2xl border border-gh-border bg-gh-surface p-6 text-center">
          <p className="text-sm text-gh-text">No active sessions yet.</p>
          <p className="mt-2 text-xs text-gh-muted">
            Start a Copilot CLI session and it will appear here automatically.
          </p>
        </div>
      )}

      {openSessions.length > 0 && (
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
              className="mt-3 inline-flex rounded-full border border-gh-border bg-gh-bg px-3 py-2 text-sm font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
            >
              Reset browse
            </button>
          </div>
        )
      )}
    </section>
  );
}
