import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { SessionWatchPane } from './SessionWatchPane.tsx';

const MIN_PANE_WIDTH = 360;
const MAX_PANES = 4;

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

export function SessionWatchMode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const viewportWidth = useViewportWidth();

  const ids = useMemo(() => {
    const raw = searchParams.get('ids') ?? '';
    return raw.split(',').filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    if (ids.length === 0) {
      navigate('/', { replace: true });
    }
  }, [ids.length, navigate]);

  const maxPanes = useMemo(() => {
    return Math.max(1, Math.min(MAX_PANES, Math.floor(viewportWidth / MIN_PANE_WIDTH)));
  }, [viewportWidth]);

  const paneWidth = useMemo(() => {
    if (ids.length === 0) return MIN_PANE_WIDTH;
    return Math.max(MIN_PANE_WIDTH, Math.floor(viewportWidth / Math.min(ids.length, maxPanes)));
  }, [viewportWidth, ids.length, maxPanes]);

  const visibleCount = Math.min(ids.length, maxPanes);

  if (ids.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-gh-border bg-gh-surface px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-gh-text">Watch mode</h1>
          <p className="text-sm text-gh-muted">
            {ids.length} session{ids.length !== 1 ? 's' : ''} selected
            {ids.length > maxPanes ? (
              <span className="ml-2 text-gh-accent">
                · {visibleCount} visible · scroll for more
              </span>
            ) : (
              <span className="ml-2 text-gh-muted">· all visible</span>
            )}
          </p>
        </div>
        <Link
          to="/"
          className="rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-xs font-medium text-gh-text transition-colors hover:bg-gh-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40"
        >
          Back to list
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full">
          {ids.map((id) => (
            <div
              key={id}
              className="h-full flex-shrink-0 flex-grow-0 overflow-y-auto border-r border-gh-border bg-gh-bg p-3"
              style={{ width: `${paneWidth}px`, minWidth: `${MIN_PANE_WIDTH}px` }}
            >
              <SessionWatchPane sessionId={id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
