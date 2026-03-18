import { useNavigate } from 'react-router-dom';
import type { SessionSummary } from '../../api/client.ts';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { AttentionBadge } from './AttentionBadge.tsx';

interface Props {
  session: SessionSummary;
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  // Show last 2 path segments
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p;
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
            {session.isOpen && !session.needsAttention && (
              <span className="inline-flex items-center gap-1 text-xs text-gh-active">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
                Active
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
            className="text-gh-muted text-xs font-mono truncate max-w-[200px]"
            title={session.projectPath}
          >
            {shortenPath(session.projectPath)}
          </span>
          {session.gitBranch && (
            <span className="text-gh-accent text-xs font-mono truncate max-w-[200px]">
              {session.gitBranch}
            </span>
          )}
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

      {/* Messages */}
      <td className="py-3 px-4 hidden md:table-cell text-right">
        <span className="text-gh-muted text-xs tabular-nums">
          {session.messageCount}
        </span>
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
