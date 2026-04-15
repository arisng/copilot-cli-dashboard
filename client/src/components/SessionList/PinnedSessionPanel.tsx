import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.ts';
import { SessionStatusBadge } from './SessionStatusBadge.tsx';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { getProjectLabel } from '../../hooks/useSessionBrowse.ts';

interface Props {
  sessionId: string;
  onUnpin: () => void;
}

export function PinnedSessionPanel({ sessionId, onUnpin }: Props) {
  const { session, loading, error } = useSession(sessionId);

  if (loading && !session) {
    return (
      <div className="rounded-lg border border-gh-border bg-gh-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gh-muted">Pinned</span>
          <button
            type="button"
            onClick={onUnpin}
            className="text-[11px] text-gh-muted transition-colors hover:text-gh-text"
          >
            Unpin
          </button>
        </div>
        <p className="mt-2 text-sm text-gh-muted">Loading…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="rounded-lg border border-gh-border bg-gh-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gh-muted">Pinned</span>
          <button
            type="button"
            onClick={onUnpin}
            className="text-[11px] text-gh-muted transition-colors hover:text-gh-text"
          >
            Unpin
          </button>
        </div>
        <p className="mt-2 text-sm text-gh-attention">{error || 'Session not found'}</p>
      </div>
    );
  }

  const activeAgents = session.activeSubAgents.filter((a) => !a.isCompleted);

  return (
    <div className="rounded-lg border border-gh-border bg-gh-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <SessionStatusBadge session={session} compact pulse={false} />
        <button
          type="button"
          onClick={onUnpin}
          className="shrink-0 text-[11px] text-gh-muted transition-colors hover:text-gh-text"
          title="Unpin session"
        >
          Unpin
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-gh-text line-clamp-2">{session.title}</h3>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gh-muted">{getProjectLabel(session.projectPath)}</span>
        {session.gitBranch && (
          <span className="rounded-full border border-gh-accent/20 bg-gh-accent/5 px-2 py-0.5 text-[10px] font-mono text-gh-accent">
            {session.gitBranch}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ModeBadge mode={session.currentMode} className="rounded-full px-2 py-0.5 text-[10px]" />
        {session.model && (
          <span
            className="inline-flex max-w-full items-center truncate rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-0.5 text-[10px] font-mono text-gh-muted"
            title={session.model}
          >
            {session.model}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gh-muted">
        <span>{formatDuration(session.durationMs)} · {session.messageCount} msg{session.messageCount === 1 ? '' : 's'}</span>
        <RelativeTime timestamp={session.lastActivityAt} />
      </div>

      {activeAgents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {activeAgents.slice(0, 2).map((agent) => (
            <span
              key={agent.toolCallId}
              className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[10px] font-mono text-gh-accent"
            >
              <span className="h-1 w-1 animate-pulse rounded-full bg-gh-active" />
              {agent.agentDisplayName || agent.agentName}
            </span>
          ))}
          {activeAgents.length > 2 && (
            <span className="text-[10px] text-gh-muted">+{activeAgents.length - 2}</span>
          )}
        </div>
      )}

      <Link
        to={`/sessions/${session.id}`}
        className="mt-3 block w-full rounded-md border border-gh-accent/30 bg-gh-accent/10 px-3 py-1.5 text-center text-xs font-medium text-gh-accent transition-colors hover:bg-gh-accent/15"
      >
        Open full detail
      </Link>
    </div>
  );
}
