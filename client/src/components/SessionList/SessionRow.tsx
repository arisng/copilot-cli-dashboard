import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionSummary } from '../../api/client.ts';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { AttentionBadge } from './AttentionBadge.tsx';

interface Props {
  session: SessionSummary;
}

function lastPathSegment(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p;
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
      onClick={handleClick}
      title="Copy branch name"
      className="group flex items-center gap-1 text-gh-accent text-xs font-mono truncate max-w-[200px] hover:text-gh-accent/80"
    >
      <span className="truncate">{branch}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {copied ? '✓' : (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
          </svg>
        )}
      </span>
    </button>
  );
}

export function SessionRow({ session }: Props) {
  const navigate = useNavigate();

  return (
    <tr
      onClick={() => navigate(`/sessions/${session.id}`)}
      className={`
        border-b border-gh-border cursor-pointer transition-colors
        hover:bg-gh-surface/70
        ${session.needsAttention ? 'border-l-2 border-l-gh-attention' : ''}
      `}
    >
      {/* Title + badges */}
      <td className="py-3 px-4">
        <div className="flex flex-col gap-1">
          <span className="text-gh-text font-medium text-sm leading-snug line-clamp-2">
            {session.title}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {session.needsAttention && <AttentionBadge />}
            {session.isAborted && !session.needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs text-gh-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
                Aborted by user
              </span>
            )}
            {session.isTaskComplete && !session.needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs text-gh-active">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
                Task complete
              </span>
            )}
            {session.isWorking && !session.needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs text-gh-active">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
                Working
              </span>
            )}
            {session.isIdle && !session.needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs text-gh-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
                Idle
              </span>
            )}
            {!session.isOpen && (
              <span className="text-xs text-gh-muted">Closed</span>
            )}
          </div>
        </div>
      </td>

      {/* Project path */}
      <td className="py-3 px-4 hidden sm:table-cell">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-gh-muted text-xs font-mono"
            title={session.projectPath}
          >
            {lastPathSegment(session.projectPath)}
          </span>
          {session.gitBranch && <CopyBranch branch={session.gitBranch} />}
        </div>
      </td>

      {/* Duration */}
      <td className="py-3 px-4 hidden md:table-cell text-right">
        <span className="text-gh-muted text-xs tabular-nums">
          {formatDuration(session.durationMs)}
        </span>
      </td>

      {/* Last activity */}
      <td className="py-3 px-4 text-right">
        <RelativeTime
          timestamp={session.lastActivityAt}
          className="text-gh-muted text-xs tabular-nums"
        />
      </td>

      {/* Chevron */}
      <td className="py-3 px-4 text-gh-muted">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </td>
    </tr>
  );
}
