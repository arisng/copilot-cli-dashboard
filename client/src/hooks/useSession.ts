import { useState, useEffect, useCallback } from 'react';
import { fetchSession, type SessionDetail } from '../api/client.ts';
import { getCachedSession, setCachedSession } from '../api/cache.ts';

export function useSession(id: string) {
  const [session, setSession] = useState<SessionDetail | null>(() => getCachedSession(id));
  const [loading, setLoading] = useState(() => getCachedSession(id) === null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchSession(id);
      setCachedSession(id, data);
      setSession(data);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Seed from cache immediately when ID changes (covers navigating to a different session)
    const cached = getCachedSession(id);
    if (cached) {
      setSession(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

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
  }, [id, load]);

  return { session, loading, error, refetch: load };
}
