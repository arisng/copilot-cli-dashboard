import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { MobileSessionPaneInner } from '../mobile/MobileSessionPane.tsx';

interface SessionWatchPaneProps {
  sessionId: string;
}

export function SessionWatchPane({ sessionId }: SessionWatchPaneProps) {
  const { session, loading, error } = useSession(sessionId);
  const [, setSearchParams] = useSearchParams();

  function handleClose() {
    setSearchParams((prev) => {
      const ids = (prev.get('ids') ?? '').split(',').filter(Boolean).filter((id) => id !== sessionId);
      if (ids.length === 0) {
        prev.delete('ids');
      } else {
        prev.set('ids', ids.join(','));
      }
      return prev;
    }, { replace: true });
  }

  if (loading && !session) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-3 text-xs text-gh-attention">
        {error}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-gh-border bg-gh-surface p-3 text-xs text-gh-muted">
        Session not found.
      </div>
    );
  }

  return (
    <div className="relative -mx-3 -mt-3 h-full">
      {/* Close button positioned outside the scroll area */}
      <button
        type="button"
        onClick={handleClose}
        title="Remove pane"
        aria-label={`Remove ${session.title} from watch mode`}
        className="absolute right-2 top-2 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-gh-border bg-gh-surface text-xs font-medium text-gh-muted transition-colors hover:border-gh-attention/40 hover:text-gh-attention"
      >
        ×
      </button>
      <div className="h-full overflow-y-auto">
        <MobileSessionPaneInner session={session} />
        {error ? (
          <div className="mx-3 mb-4 rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-3 text-xs text-gh-attention">
            Live updates are temporarily failing: {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
