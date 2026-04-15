import { useEffect, useState } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { checkHealth } from '../../api/client.ts';
import { useSessions } from '../../hooks/useSessions.ts';
import { useNotifications, useSessionNotifications } from '../../hooks/useNotifications.ts';

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  const [serverOk, setServerOk] = useState(true);
  const { sessions } = useSessions();
  const { permission, request, markUnavailable } = useNotifications();
  const { pathname } = useLocation();
  const detailMatch = useMatch('/sessions/:id');
  const watchMatch = useMatch('/watch');
  const isDesktopDetailRoute = detailMatch !== null;
  const isWatchRoute = watchMatch !== null;
  const isListRoute = pathname === '/';
  const mobileHref = detailMatch?.params.id ? `/m/sessions/${detailMatch.params.id}` : '/m';
  const showMobileSwitch = pathname === '/' || detailMatch !== null;
  useSessionNotifications(sessions, permission, markUnavailable);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function ping(delayMs: number) {
      timeoutId = window.setTimeout(async () => {
        const ok = await checkHealth();
        if (cancelled) return;
        setServerOk(ok);
        ping(ok ? 10000 : 2000);
      }, delayMs);
    }

    ping(1000);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gh-bg flex flex-col overflow-hidden">
      {/* Nav bar */}
      <header className="border-b border-gh-border bg-gh-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <svg viewBox="0 0 16 16" width="20" height="20" className="text-gh-accent fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="font-semibold text-gh-text">Copilot Sessions</span>

          <div className="ml-auto">
            {permission === 'default' && (
              <button
                onClick={request}
                className="flex items-center gap-1.5 text-xs text-gh-accent border border-gh-accent/30 rounded-full px-3 py-1 hover:bg-gh-accent/10 transition-colors"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <path d="M8 16a2 2 0 001.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 008 16zm.25-14.25a.75.75 0 00-1.5 0v.461a6.002 6.002 0 00-4.75 5.789v.699l-1.616 2.476A.75.75 0 001 12.25h14a.75.75 0 00.616-1.075L14 8.699v-.699a6.002 6.002 0 00-4.75-5.789v-.461z"/>
                </svg>
                Enable notifications
              </button>
            )}
            {permission === 'granted' && (
              <span className="flex items-center gap-1.5 text-xs text-gh-active">
                <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
                Notifications on
              </span>
            )}
            {permission === 'denied' && (
              <span className="text-xs text-gh-muted" title="Notifications blocked in browser settings">
                Notifications blocked
              </span>
            )}
            {permission === 'unavailable' && (
              <span
                className="text-xs text-gh-muted"
                title="Notifications are unavailable in this browser, device, or tunnel context"
              >
                Notifications unavailable
              </span>
            )}
          </div>
        </div>
      </header>

      {showMobileSwitch && (
        <div className="border-b border-gh-border bg-gh-surface/80 md:hidden">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gh-text">
                {detailMatch ? 'Prefer the touch-first session view?' : 'On a phone?'}
              </p>
              <p className="text-xs text-gh-muted">
                {detailMatch
                  ? 'Switch this session to the matching mobile route.'
                  : 'Try the dedicated mobile experience at /m.'}
              </p>
            </div>

            <Link
              to={mobileHref}
              className="shrink-0 rounded-full border border-gh-accent/30 bg-gh-accent/10 px-3 py-1.5 text-xs font-medium text-gh-accent transition-colors hover:bg-gh-accent/15"
            >
              Open mobile
            </Link>
          </div>
        </div>
      )}

      {/* Server down banner */}
      {!serverOk && (
        <div className="bg-gh-attention/10 border-b border-gh-attention/30 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-gh-attention text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-gh-attention animate-pulse" />
            Backend server is unreachable. Start it with{' '}
            <code className="font-mono bg-gh-surface px-1 rounded">npm run dev</code>
          </div>
        </div>
      )}

      {/* Content */}
      <main
        className={`flex-1 min-h-0 w-full ${
          isDesktopDetailRoute || isListRoute
            ? 'overflow-y-auto px-4 py-6 xl:overflow-hidden xl:py-4'
            : isWatchRoute
              ? 'overflow-hidden'
              : 'max-w-7xl mx-auto overflow-y-auto px-4 py-6'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
