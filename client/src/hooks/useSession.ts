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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
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
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id, load]);

  return { session, loading, error };
}
