import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionSummary, ActiveSubAgent } from '../../api/client.ts';
import { getProjectLabel } from '../../hooks/useSessionBrowse.ts';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { SessionStatusBadge } from './SessionStatusBadge.tsx';

interface Props {
  session: SessionSummary;
}

function CopyBranch({ branch }: { branch: string }) {
  const [copied, setCopied] = useState(false);
  function handleClick(e: { stopPropagation(): void }) {
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
      className="group inline-flex max-w-full items-center gap-1 rounded-full border border-gh-accent/20 bg-gh-accent/5 px-2 py-0.5 text-[11px] font-mono text-gh-accent transition-colors hover:border-gh-accent/40 hover:bg-gh-accent/10 hover:text-gh-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-bg"
    >
      <span className="truncate">{branch}</span>
      <span className="flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100">
        {copied ? '✓' : (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
          </svg>
        )}
      </span>
    </button>
  );
}

function MetaPill({
  children,
  tone = 'muted',
  mono = false,
  className = '',
}: {
  children: ReactNode;
  tone?: 'muted' | 'active';
  mono?: boolean;
  className?: string;
}) {
  const toneClassName = tone === 'active'
    ? 'border-gh-active/20 bg-gh-active/10 text-gh-active'
    : 'border-gh-border/70 bg-gh-bg/70 text-gh-muted';

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${toneClassName} ${mono ? 'font-mono' : 'font-medium'} ${className}`}>
      {children}
    </span>
  );
}

function SubAgentRow({ agent }: { agent: ActiveSubAgent }) {
  return (
    <tr className="border-b border-gh-border/40 bg-gh-canvas/30">
      <td className="py-2 px-4 pl-10" colSpan={4}>
        <div className="flex items-center gap-2">
          {/* Tree connector */}
          <span className="text-gh-border text-xs select-none">└</span>
          {/* Sub-agent badge */}
          <span className="inline-flex items-center gap-1 text-xs bg-gh-surface border border-gh-border rounded px-1.5 py-0.5 text-gh-muted font-mono shrink-0">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" className="text-gh-accent">
              <path d="M1.5 1.75a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75a.25.25 0 01-.25-.25zM1.5 8a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75A.25.25 0 011.5 8zm.25 5.75a.25.25 0 000 .5h12.5a.25.25 0 000-.5H1.75z"/>
            </svg>
            {agent.agentName === 'read_agent' ? `Read · ${agent.description || agent.agentDisplayName}` : (agent.agentDisplayName || agent.agentName)}
          </span>
          {/* Description */}
          {agent.description && (
            <span className="text-xs text-gh-muted truncate max-w-[400px]" title={agent.description}>
              {agent.description}
            </span>
          )}
          {/* Status dot */}
          <span className="ml-auto shrink-0">
            {agent.isCompleted ? (
              <span className="inline-flex items-center gap-1 text-xs text-gh-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
                Done
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gh-active">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
                Running
              </span>
            )}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function SessionRow({ session }: Props) {
  const navigate = useNavigate();
  const hasSubAgents = session.activeSubAgents.length > 0;
  const [expanded, setExpanded] = useState(false);
  const runningAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted);

  function openSession() {
    navigate(`/sessions/${session.id}`);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSession();
    }
  }

  return (
    <>
      <tr
        onClick={openSession}
        onKeyDown={handleRowKeyDown}
        tabIndex={0}
        role="link"
        aria-label={`Open session ${session.title}`}
        className={`
          group cursor-pointer border-b border-gh-border align-top transition-colors
          hover:bg-gh-surface/60 focus-visible:bg-gh-surface/70
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gh-accent/40
          ${session.needsAttention ? 'border-l-2 border-l-gh-attention bg-gh-attention/5' : ''}
        `}
      >
        <td className="px-4 py-2.5 align-top">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <SessionStatusBadge session={session} compact pulse={false} />
              {hasSubAgents && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                  title={expanded ? 'Hide sub-agents' : 'Show sub-agents'}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Hide' : 'Show'} ${session.activeSubAgents.length} sub-agents`}
                  className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[11px] font-medium text-gh-accent transition-colors hover:border-gh-accent/30 hover:text-gh-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-bg"
                >
                  <svg
                    viewBox="0 0 16 16" width="10" height="10" fill="currentColor"
                    className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                  </svg>
                  {session.activeSubAgents.length} agent{session.activeSubAgents.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
            <span className="text-gh-text text-sm font-semibold leading-5 line-clamp-2">
              {session.title}
            </span>
          </div>
        </td>

        <td className="px-4 py-2.5 align-top">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span
              className="truncate text-xs font-mono text-gh-text/90"
              title={session.projectPath}
            >
              {getProjectLabel(session.projectPath)}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {session.gitBranch ? (
                <CopyBranch branch={session.gitBranch} />
              ) : (
                <MetaPill>No branch</MetaPill>
              )}
              <ModeBadge mode={session.currentMode} className="rounded-full px-2 py-0.5 text-[10px]" />
              {session.model && (
                <MetaPill mono className="max-w-[10rem]">
                  <span className="truncate" title={session.model}>{session.model}</span>
                </MetaPill>
              )}
            </div>
          </div>
        </td>

        <td className="px-4 py-2.5 text-right align-top">
          <div className="flex flex-col items-end gap-1.5">
            <RelativeTime
              timestamp={session.lastActivityAt}
              className="text-xs font-semibold tabular-nums text-gh-text/90"
            />
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <MetaPill>{formatDuration(session.durationMs)}</MetaPill>
              <MetaPill tone={runningAgents.length > 0 ? 'active' : 'muted'}>
                {runningAgents.length > 0
                  ? `${runningAgents.length} active agent${runningAgents.length === 1 ? '' : 's'}`
                  : `${session.messageCount} msg${session.messageCount === 1 ? '' : 's'}`}
              </MetaPill>
            </div>
          </div>
        </td>

        <td className="px-4 py-2.5 text-gh-muted align-top">
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="currentColor"
            aria-hidden="true"
            className="mt-1 transition-colors group-hover:text-gh-text"
          >
            <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        </td>
      </tr>

      {/* Sub-agent rows — shown when expanded */}
      {expanded && session.activeSubAgents.map((agent) => (
        <SubAgentRow key={agent.toolCallId} agent={agent} />
      ))}
    </>
  );
}
