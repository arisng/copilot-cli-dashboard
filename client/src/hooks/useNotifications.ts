import { useState, useEffect, useRef, useCallback } from 'react';
import type { SessionSummary } from '../api/client.ts';

type Permission = 'default' | 'granted' | 'denied';

function notify(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, tag: `${tag}-${Date.now()}`, silent: false });
}

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  );

  const request = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  return { permission, request };
}

export function useSessionNotifications(sessions: SessionSummary[], enabled: boolean) {
  const prevRef = useRef<Map<string, SessionSummary>>(new Map());
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const prev = prevRef.current;
    const justEnabled = enabled && !prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (enabled && Notification.permission === 'granted') {
      for (const session of sessions) {
        const old = prev.get(session.id);

        if (justEnabled || !old) {
          if (session.needsAttention) {
            notify('Needs your attention', session.title, `attention-${session.id}`);
          } else if (session.isTaskComplete) {
            notify('Task complete', session.title, `done-${session.id}`);
          }
        } else {
          if (!old.needsAttention && session.needsAttention) {
            notify('Needs your attention', session.title, `attention-${session.id}`);
          } else if (!old.isTaskComplete && session.isTaskComplete) {
            notify('Task complete', session.title, `done-${session.id}`);
          }
        }
      }
    }

    // Always track state so transitions are detected regardless of enabled
    prevRef.current = new Map(sessions.map((s) => [s.id, s]));
  }, [sessions, enabled]);
}
