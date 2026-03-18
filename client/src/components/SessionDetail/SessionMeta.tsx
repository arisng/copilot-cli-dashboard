import { useNavigate } from 'react-router-dom';
import type { SessionDetail } from '../../api/client.ts';
import { formatDuration } from '../shared/RelativeTime.tsx';
import { AttentionBadge } from '../SessionList/AttentionBadge.tsx';

interface Props {
  session: SessionDetail;
}

export function SessionMeta({ session }: Props) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-gh-muted text-sm hover:text-gh-accent transition-colors mb-4"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <path d="M9.78 3.22a.75.75 0 010 1.06L6.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" />
        </svg>
        All sessions
      </button>

      {/* Title + badges */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-gh-text leading-snug">
          {session.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {session.needsAttention && <AttentionBadge />}
          {session.isOpen && !session.needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs text-gh-active font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
              Active
            </span>
          )}
          {!session.isOpen && (
            <span className="text-xs text-gh-muted border border-gh-border rounded-full px-2 py-0.5">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Meta pills */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gh-muted">
        <span
          className="flex items-center gap-1 font-mono truncate max-w-xs"
          title={session.projectPath}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z" />
          </svg>
          {session.projectPath}
        </span>

        {session.gitBranch && (
          <span className="flex items-center gap-1 font-mono text-gh-accent">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
            </svg>
            {session.gitBranch}
          </span>
        )}

        <span className="flex items-center gap-1">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M1 5.25A2.25 2.25 0 013.25 3h9.5A2.25 2.25 0 0115 5.25v5.5A2.25 2.25 0 0112.75 13h-9.5A2.25 2.25 0 011 10.75v-5.5zm2.25-.75a.75.75 0 00-.75.75v5.5c0 .414.336.75.75.75h9.5a.75.75 0 00.75-.75v-5.5a.75.75 0 00-.75-.75h-9.5z" />
          </svg>
          {formatDuration(session.durationMs)}
        </span>

        {session.model && (
          <span className="font-mono">{session.model}</span>
        )}

        <span>{session.messageCount} message{session.messageCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
