import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionDetail } from '../../api/client.ts';
import { formatDuration } from '../shared/RelativeTime.tsx';
import { AttentionBadge } from '../SessionList/AttentionBadge.tsx';

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
      className="group flex items-center gap-1.5 font-mono text-gh-accent hover:text-gh-accent/80 transition-colors"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
        <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
      </svg>
      <span>{branch}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
        {copied ? '✓' : (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
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
          {session.isAborted && !session.needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs text-gh-muted font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
              Aborted by user
            </span>
          )}
          {session.isTaskComplete && !session.needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs text-gh-active font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
              Task complete
            </span>
          )}
          {session.isWorking && !session.needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs text-gh-active font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
              Working
            </span>
          )}
          {session.isIdle && !session.needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs text-gh-muted font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
              Idle
            </span>
          )}
          {!session.isOpen && (
            <span className="text-xs text-gh-muted border border-gh-border rounded-full px-2 py-0.5">
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Meta bar: project on the left, branch + duration on the right */}
      <div className="flex items-center mt-3 text-xs text-gh-muted">
        <span
          className="font-mono"
          title={session.projectPath}
        >
          {session.projectPath.split('/').filter(Boolean).pop() ?? session.projectPath}
        </span>

        <div className="ml-auto flex items-center gap-4">
          {session.gitBranch && <CopyBranch branch={session.gitBranch} />}

          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm7-3.25v2.992l2.028 2.03a.75.75 0 01-1.06 1.06l-2.2-2.2a.75.75 0 01-.22-.53V4.75a.75.75 0 011.5 0z" />
            </svg>
            {formatDuration(session.durationMs)}
          </span>

          {session.model && (
            <span className="font-mono">{session.model}</span>
          )}
        </div>
      </div>
    </div>
  );
}
