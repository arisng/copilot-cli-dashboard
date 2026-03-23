import { useState, useEffect, useCallback } from 'react';
import { fetchSessions, type SessionSummary } from '../api/client.ts';
import { getCachedSessions, setCachedSessions } from '../api/cache.ts';

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>(() => getCachedSessions() ?? []);
  const [loading, setLoading] = useState(() => getCachedSessions() === null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchSessions();
      setCachedSessions(data);
      setSessions(data);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const schedule = (delayMs: number) => {
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        const ok = await load();
        if (!cancelled) {
          schedule(ok ? 5000 : 1000);
        }
      }, delayMs);
    };

    schedule(1000);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [load]);

  return { sessions, loading, error };
}
