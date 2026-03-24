import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionDetail } from '../../api/client.ts';
import { getProjectLabel } from '../../hooks/useSessionBrowse.ts';
import { AttentionBadge } from '../SessionList/AttentionBadge.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isDone(status: string) {
  return status === 'done' || status === 'completed' || status === 'cancelled';
}

function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function getPromptSummary(session: SessionDetail) {
  const source = session.messages.find((message) => message.role === 'user' && message.content.trim())?.content ?? session.title;
  const condensed = source
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!condensed) {
    return 'No prompt summary has been captured for this session yet.';
  }

  return condensed.length > 220 ? `${condensed.slice(0, 217)}...` : condensed;
}

function getSessionCallout(session: SessionDetail, todoCount: number, activeAgents: number, completedAgents: number) {
  if (session.needsAttention) {
    return {
      title: 'Needs attention',
      description: 'This session is likely waiting for user input, approval, or a blocked tool response.',
      toneClass: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
    };
  }

  if (session.isPlanPending) {
    return {
      title: 'Plan ready for review',
      description: 'Review the captured plan before the session continues with execution.',
      toneClass: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
    };
  }

  if (session.isWorking) {
    return {
      title: 'Actively working',
      description:
        activeAgents > 0
          ? `${pluralize(activeAgents, 'sub-agent')} are still running alongside the main thread.`
          : todoCount > 0
            ? `${pluralize(todoCount, 'todo')} are tracking the active run.`
            : 'Recent activity is still arriving in the main session thread.',
      toneClass: 'border-gh-active/30 bg-gh-active/10 text-gh-active',
    };
  }

  if (session.isTaskComplete) {
    return {
      title: 'Task complete',
      description:
        completedAgents > 0
          ? `The main session finished and ${pluralize(completedAgents, 'sub-agent')} also completed.`
          : 'The session reported completion and is ready for review.',
      toneClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    };
  }

  if (session.isAborted) {
    return {
      title: 'Aborted',
      description: 'The run stopped before completion. Review the latest activity for context.',
      toneClass: 'border-red-500/30 bg-red-500/10 text-red-300',
    };
  }

  if (session.isIdle) {
    return {
      title: 'Idle',
      description: 'No recent updates are arriving, but the captured history is available below.',
      toneClass: 'border-gh-border bg-gh-bg/70 text-gh-text',
    };
  }

  if (!session.isOpen) {
    return {
      title: 'Closed',
      description: 'The session is no longer open, but its messages, plan, todos, and agents remain available.',
      toneClass: 'border-gh-border bg-gh-bg/70 text-gh-text',
    };
  }

  return {
    title: 'Monitoring',
    description:
      activeAgents > 0
        ? `${pluralize(activeAgents, 'sub-agent')} remain visible while the session stays open.`
        : 'This session is open and will refresh automatically as new activity arrives.',
    toneClass: 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent',
  };
}

function SessionStatusBadges({ session }: { session: SessionDetail }) {
  return (
    <>
      {session.needsAttention && <AttentionBadge />}
      {session.isAborted && !session.needsAttention && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Aborted by user
        </span>
      )}
      {session.isTaskComplete && !session.needsAttention && (
        <span className="inline-flex items-center gap-1 rounded-full border border-gh-active/20 bg-gh-active/10 px-2 py-1 text-xs font-medium text-gh-active">
          <span className="h-1.5 w-1.5 rounded-full bg-gh-active" />
          Task complete
        </span>
      )}
      {session.isWorking && !session.needsAttention && (
        <span className="inline-flex items-center gap-1 rounded-full border border-gh-active/20 bg-gh-active/10 px-2 py-1 text-xs font-medium text-gh-active">
          <span className="h-1.5 w-1.5 rounded-full bg-gh-active animate-pulse" />
          Working
        </span>
      )}
      {session.isIdle && !session.needsAttention && (
        <span className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg/70 px-2 py-1 text-xs font-medium text-gh-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-gh-muted" />
          Idle
        </span>
      )}
      {!session.isOpen && (
        <span className="inline-flex items-center rounded-full border border-gh-border bg-gh-bg/70 px-2 py-1 text-xs text-gh-muted">
          Closed
        </span>
      )}
    </>
  );
}

function SignalChip({
  tone,
  children,
}: {
  tone: 'attention' | 'active' | 'default';
  children: ReactNode;
}) {
  const toneClass = tone === 'attention'
    ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention'
    : tone === 'active'
      ? 'border-gh-active/30 bg-gh-active/10 text-gh-active'
      : 'border-gh-border bg-gh-bg/70 text-gh-muted';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] opacity-75">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-5 text-current">{value}</div>
      <div className="mt-1 text-xs opacity-80">{detail}</div>
    </div>
  );
}

function CopyBranch({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(branch).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy branch name"
      className="group flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-1 font-mono text-gh-accent transition-colors hover:border-gh-accent/30 hover:text-gh-accent/80"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
      </svg>
      <span className="truncate">{branch}</span>
      <span className="text-xs opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? '✓' : (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
          </svg>
        )}
      </span>
    </button>
  );
}

interface Props {
  session: SessionDetail;
}

export function SessionMeta({ session }: Props) {
  const navigate = useNavigate();
  const todos = session.todos ?? [];
  const activeTodos = todos.filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = todos.filter((todo) => todo.status === 'blocked').length;
  const doneTodos = todos.filter((todo) => isDone(todo.status)).length;
  const activeAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
  const completedAgents = session.activeSubAgents.length - activeAgents;
  const callout = getSessionCallout(session, todos.length, activeAgents, completedAgents);
  const promptSummary = getPromptSummary(session);
  const signals = [
    session.needsAttention
      ? { label: 'User follow-up likely needed', tone: 'attention' as const }
      : { label: session.isOpen ? 'Session open' : 'Session archived', tone: session.isOpen ? 'active' as const : 'default' as const },
    session.isPlanPending
      ? { label: 'Plan awaiting approval', tone: 'attention' as const }
      : session.hasPlan
        ? { label: 'Plan captured', tone: 'default' as const }
        : { label: 'No plan captured', tone: 'default' as const },
    blockedTodos > 0
      ? { label: pluralize(blockedTodos, 'blocked todo'), tone: 'attention' as const }
      : activeTodos > 0
        ? { label: pluralize(activeTodos, 'active todo'), tone: 'active' as const }
        : todos.length > 0
          ? { label: pluralize(doneTodos, 'done todo'), tone: 'default' as const }
          : { label: 'No todos yet', tone: 'default' as const },
    activeAgents > 0
      ? { label: pluralize(activeAgents, 'running sub-agent'), tone: 'active' as const }
      : completedAgents > 0
        ? { label: pluralize(completedAgents, 'completed sub-agent'), tone: 'default' as const }
        : { label: 'No sub-agent threads', tone: 'default' as const },
  ];

  return (
    <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gh-muted transition-colors hover:text-gh-accent shrink-0"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M9.78 3.22a.75.75 0 010 1.06L6.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" />
        </svg>
        All sessions
      </button>

      {/* Main Overview Panel - Vertical Stack Layout */}
      <section className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
        {/* Session Header Block */}
        <div className="flex flex-col gap-3">
          {/* Title with adjusted font size (20px = 1.25rem) */}
          <h1 className="text-xl font-semibold leading-tight text-gh-text break-words">
            {session.title}
          </h1>

          {/* Status Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <SessionStatusBadges session={session} />
          </div>

          {/* Metadata Row */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-gh-muted">
            <span
              className="max-w-full truncate rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-1 font-mono text-gh-text"
              title={session.projectPath}
            >
              {getProjectLabel(session.projectPath)}
            </span>
            <ModeBadge mode={session.currentMode} />
            {session.model && (
              <span className="max-w-full truncate rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-1 font-mono text-gh-muted/80">
                {session.model}
              </span>
            )}
            {session.gitBranch && <CopyBranch branch={session.gitBranch} />}
            <span className="inline-flex items-center gap-1 rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-1">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm7-3.25v2.992l2.028 2.03a.75.75 0 01-1.06 1.06l-2.2-2.2a.75.75 0 01-.22-.53V4.75a.75.75 0 011.5 0z" />
              </svg>
              {formatDuration(session.durationMs)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gh-accent" />
              Last activity <RelativeTime timestamp={session.lastActivityAt} className="text-gh-text" />
            </span>
          </div>
        </div>

        {/* Status Callout Card */}
        <div className={`rounded-xl border p-4 ${callout.toneClass}`}>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Status</p>
          <p className="mt-2 text-lg font-semibold leading-tight">{callout.title}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-90">{callout.description}</p>
        </div>

        {/* Prompt Summary Block */}
        <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gh-muted">Prompt summary</p>
          <p className="mt-2 text-sm leading-relaxed text-gh-text">
            {promptSummary}
          </p>
        </div>

        {/* Attention Signals Block */}
        <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gh-muted">Attention signals</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signals.map((signal) => (
              <SignalChip key={signal.label} tone={signal.tone}>
                {signal.label}
              </SignalChip>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gh-muted">Started</p>
            <p className="mt-1 text-sm font-semibold text-gh-text">{formatAbsoluteTime(session.startedAt)}</p>
            <p className="mt-1 text-xs text-gh-muted"><RelativeTime timestamp={session.startedAt} /></p>
          </div>
          <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gh-muted">Last seen</p>
            <p className="mt-1 text-sm font-semibold text-gh-text">
              <RelativeTime timestamp={session.lastActivityAt} />
            </p>
            <p className="mt-1 text-xs text-gh-muted">{formatAbsoluteTime(session.lastActivityAt)}</p>
          </div>
          <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gh-muted">Todo progress</p>
            <p className="mt-1 text-sm font-semibold text-gh-text">{doneTodos}/{todos.length || 0}</p>
            <p className="mt-1 text-xs text-gh-muted">
              {todos.length > 0 ? `${activeTodos} active · ${blockedTodos} blocked` : 'No todos yet'}
            </p>
          </div>
          <div className="rounded-xl border border-gh-border bg-gh-surface/40 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gh-muted">Sub-agent threads</p>
            <p className="mt-1 text-sm font-semibold text-gh-text">{session.activeSubAgents.length}</p>
            <p className="mt-1 text-xs text-gh-muted">
              {session.activeSubAgents.length > 0
                ? `${activeAgents} running · ${completedAgents} done`
                : 'No agents recorded'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
