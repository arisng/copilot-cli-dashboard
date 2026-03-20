import type { SessionSummary, SessionDetail } from './client.ts';

// Module-level cache — survives component unmounts and route changes.
// Data is served immediately on mount (no loading flash), then refreshed in the background.

let sessionsCache: SessionSummary[] | null = null;
const sessionCache = new Map<string, SessionDetail>();

export function getCachedSessions(): SessionSummary[] | null {
  return sessionsCache;
}

export function setCachedSessions(sessions: SessionSummary[]): void {
  sessionsCache = sessions;
  // Keep individual session summaries in sync so useSession can seed from them
  for (const s of sessions) {
    const existing = sessionCache.get(s.id);
    if (existing) {
      // Merge summary fields into existing detail cache
      sessionCache.set(s.id, { ...existing, ...s });
    }
  }
}

export function getCachedSession(id: string): SessionDetail | null {
  return sessionCache.get(id) ?? null;
}

export function setCachedSession(id: string, session: SessionDetail): void {
  sessionCache.set(id, session);
  // Keep sessions list cache in sync
  if (sessionsCache) {
    sessionsCache = sessionsCache.map((s) => (s.id === id ? { ...s, ...session } : s));
  }
}
