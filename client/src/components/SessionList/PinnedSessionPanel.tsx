import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.ts';
import { SessionStatusBadge } from './SessionStatusBadge.tsx';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { getProjectLabel } from '../../hooks/useSessionBrowse.ts';
import type { MessagePreview } from '../../api/client.ts';

interface Props {
  sessionId: string;
  onUnpin: () => void;
}

function LastMessage({ message }: { message: MessagePreview }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 mt-0.5 ${
          isUser ? 'bg-gh-accent/20 text-gh-accent' : 'bg-gh-active/20 text-gh-active'
        }`}
      >
        {isUser ? 'U' : 'C'}
      </div>
      <div
        className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 ${
          isUser
            ? 'bg-gh-accent/8 border border-gh-accent/15 rounded-tr-sm'
            : 'bg-gh-bg border border-gh-border rounded-tl-sm'
        }`}
      >
        {message.snippet && (
          <p className="text-xs text-gh-muted leading-relaxed line-clamp-4">{message.snippet}</p>
        )}
      </div>
    </div>
  );
}

export function PinnedSessionPanel({ sessionId, onUnpin }: Props) {
  const { session, loading, error } = useSession(sessionId);

  if (loading && !session) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-lg border border-gh-border bg-gh-surface">
        <div className="flex items-center justify-between gap-2 border-b border-gh-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-gh-muted">Pinned session</span>
          <button
            type="button"
            onClick={onUnpin}
            className="text-[11px] text-gh-muted hover:text-gh-text"
          >
            Unpin
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-gh-muted">Loading pinned session…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-lg border border-gh-border bg-gh-surface">
        <div className="flex items-center justify-between gap-2 border-b border-gh-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-gh-muted">Pinned session</span>
          <button
            type="button"
            onClick={onUnpin}
            className="text-[11px] text-gh-muted hover:text-gh-text"
          >
            Unpin
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <p className="text-sm text-gh-attention">{error || 'Session not found'}</p>
          <button
            type="button"
            onClick={onUnpin}
            className="mt-3 rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-xs text-gh-text transition-colors hover:bg-gh-surface"
          >
            Unpin
          </button>
        </div>
      </div>
    );
  }

  const previews = session.previewMessages ?? [];
  const lastMessage = previews[previews.length - 1];
  const activeAgents = session.activeSubAgents.filter((a) => !a.isCompleted);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gh-border bg-gh-surface">
      <div className="flex items-center justify-between gap-2 border-b border-gh-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gh-muted">Pinned session</span>
        <button
          type="button"
          onClick={onUnpin}
          className="text-[11px] text-gh-muted transition-colors hover:text-gh-text"
          title="Unpin session"
        >
          Unpin
        </button>
      </div>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4">
        <div>
          <SessionStatusBadge session={session} pulse={false} />
          <h3 className="mt-2 text-sm font-semibold text-gh-text line-clamp-2">{session.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gh-muted">{getProjectLabel(session.projectPath)}</span>
            {session.gitBranch && (
              <span className="rounded-full border border-gh-accent/20 bg-gh-accent/5 px-2 py-0.5 text-[10px] font-mono text-gh-accent">
                {session.gitBranch}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-gh-border/70 bg-gh-bg/70 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">Duration</p>
            <p className="mt-1 text-xs font-semibold text-gh-text">{formatDuration(session.durationMs)}</p>
          </div>
          <div className="rounded-md border border-gh-border/70 bg-gh-bg/70 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">Messages</p>
            <p className="mt-1 text-xs font-semibold text-gh-text">{session.messageCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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

        <div className="flex items-center justify-between text-xs text-gh-muted">
          <span>Last activity</span>
          <RelativeTime timestamp={session.lastActivityAt} />
        </div>

        {lastMessage && (
          <div className="rounded-md border border-gh-border/50 bg-gh-bg/50 p-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">
              Latest {lastMessage.role}
            </p>
            <LastMessage message={lastMessage} />
          </div>
        )}

        {activeAgents.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">Active agents</p>
            <div className="flex flex-wrap gap-1.5">
              {activeAgents.map((agent) => (
                <span
                  key={agent.toolCallId}
                  className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[10px] font-mono text-gh-accent"
                >
                  <span className="h-1 w-1 animate-pulse rounded-full bg-gh-active" />
                  {agent.agentDisplayName || agent.agentName}
                </span>
              ))}
            </div>
          </div>
        )}

        <Link
          to={`/sessions/${session.id}`}
          className="block w-full rounded-md border border-gh-accent/30 bg-gh-accent/10 px-3 py-2 text-center text-xs font-medium text-gh-accent transition-colors hover:bg-gh-accent/15"
        >
          Open full detail
        </Link>
      </div>
    </div>
  );
}
