import { useEffect, useState } from 'react';
import { Link, NavLink, useMatch } from 'react-router-dom';
import { checkHealth } from '../../api/client.ts';
import { useSessions } from '../../hooks/useSessions.ts';
import { useNotifications, useSessionNotifications } from '../../hooks/useNotifications.ts';

interface Props {
  children: React.ReactNode;
}

export function MobileLayout({ children }: Props) {
  const [serverOk, setServerOk] = useState(true);
  const { sessions } = useSessions();
  const { permission, request, markUnavailable } = useNotifications();
  const detailMatch = useMatch('/m/sessions/:id');
  const desktopHref = detailMatch?.params.id ? `/sessions/${detailMatch.params.id}` : '/';

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
    <div className="min-h-screen bg-gh-bg text-gh-text">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-6">
        <header
          data-testid="mobile-layout"
          className="sticky top-0 z-10 -mx-3 border-b border-gh-border/80 bg-gh-bg/95 px-3 backdrop-blur"
        >
          <div className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-gh-accent/80">
                  Mobile namespace · /m
                </p>
                <h1 className="mt-1 text-base font-semibold text-gh-text">
                  {detailMatch ? 'Session detail' : 'Sessions'}
                </h1>
                <p className="mt-1 text-xs text-gh-muted">
                  {detailMatch
                    ? 'Touch-first detail views for activity, work, and sub-agent threads.'
                    : 'A dedicated mobile dashboard for triaging and opening live Copilot sessions.'}
                </p>
              </div>

              <Link
                to={desktopHref}
                className="shrink-0 rounded-full border border-gh-border bg-gh-surface px-3 py-1.5 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
              >
                Desktop
              </Link>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <NavLink
                to="/m"
                end
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-gh-accent text-white'
                      : 'border border-gh-border bg-gh-surface text-gh-muted hover:text-gh-text'
                  }`
                }
              >
                Sessions
              </NavLink>

              {detailMatch && (
                <span className="rounded-full border border-gh-border bg-gh-surface px-3 py-1.5 text-xs font-medium text-gh-text">
                  Detail
                </span>
              )}

              <div className="ml-auto">
                {permission === 'default' && (
                  <button
                    onClick={request}
                    className="rounded-full border border-gh-accent/30 bg-gh-accent/10 px-3 py-1.5 text-xs font-medium text-gh-accent transition-colors hover:bg-gh-accent/15"
                  >
                    Enable alerts
                  </button>
                )}

                {permission === 'granted' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gh-active/30 bg-gh-active/10 px-3 py-1.5 text-xs font-medium text-gh-active">
                    <span className="h-1.5 w-1.5 rounded-full bg-gh-active" />
                    Alerts on
                  </span>
                )}

                {permission === 'denied' && (
                  <span className="rounded-full border border-gh-border bg-gh-surface px-3 py-1.5 text-xs text-gh-muted">
                    Alerts blocked
                  </span>
                )}

                {permission === 'unavailable' && (
                  <span
                    className="rounded-full border border-gh-border bg-gh-surface px-3 py-1.5 text-xs text-gh-muted"
                    title="Alerts are unavailable in this browser, device, or tunnel context"
                  >
                    Alerts unavailable
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {!serverOk && (
          <div className="mt-3 rounded-2xl border border-gh-attention/30 bg-gh-attention/10 px-4 py-3 text-sm text-gh-attention">
            Backend server is unreachable. Start it with{' '}
            <code className="rounded bg-gh-surface px-1 font-mono">npm run dev</code>.
          </div>
        )}

        <main className="flex-1 py-4">{children}</main>

        <footer className="border-t border-gh-border/60 pt-4 text-center text-xs text-gh-muted">
          Mobile routes live at <code className="font-mono text-gh-text">/m</code> so phone-first UX can
          evolve without disrupting the desktop dashboard.
        </footer>
      </div>
    </div>
  );
}
