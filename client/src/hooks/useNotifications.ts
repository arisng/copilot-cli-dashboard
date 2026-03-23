import { useState, useEffect, useRef, useCallback } from 'react';
import type { SessionSummary } from '../api/client.ts';

type Permission = NotificationPermission | 'unavailable';

function getNotificationApi(): typeof Notification | null {
  if (typeof window === 'undefined') return null;

  try {
    return 'Notification' in window ? window.Notification : null;
  } catch {
    return null;
  }
}

function normalizePermission(value: unknown): NotificationPermission | null {
  return value === 'default' || value === 'granted' || value === 'denied' ? value : null;
}

function readPermission(notificationApi: typeof Notification): NotificationPermission | null {
  try {
    return normalizePermission(notificationApi.permission);
  } catch {
    return null;
  }
}

function getNotificationStatus(): Permission {
  const notificationApi = getNotificationApi();
  if (!notificationApi) return 'unavailable';

  const permission = readPermission(notificationApi);
  if (permission === null) return 'unavailable';
  if (permission !== 'default') return permission;

  return typeof notificationApi.requestPermission === 'function' ? permission : 'unavailable';
}

function notify(title: string, body: string, tag: string) {
  const notificationApi = getNotificationApi();
  if (!notificationApi) return false;

  try {
    const permission = readPermission(notificationApi);
    if (permission === null) return false;
    if (permission !== 'granted') return true;
    new notificationApi(title, { body, tag: `${tag}-${Date.now()}`, silent: false });
    return true;
  } catch (error) {
    console.warn('Notification delivery failed; disabling in-app notifications.', error);
    return false;
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(getNotificationStatus);

  const request = useCallback(async () => {
    const notificationApi = getNotificationApi();
    if (!notificationApi || typeof notificationApi.requestPermission !== 'function') {
      setPermission('unavailable');
      return 'unavailable';
    }

    try {
      const result = await notificationApi.requestPermission();
      const nextPermission = normalizePermission(result) ?? getNotificationStatus();
      setPermission(nextPermission);
      return nextPermission;
    } catch (error) {
      console.warn('Notification permission request failed; marking notifications unavailable.', error);
      setPermission('unavailable');
      return 'unavailable';
    }
  }, []);

  const markUnavailable = useCallback(() => {
    setPermission((current) => (current === 'unavailable' ? current : 'unavailable'));
  }, []);

  return { permission, request, markUnavailable };
}

export function useSessionNotifications(
  sessions: SessionSummary[],
  permission: Permission,
  onUnavailable?: () => void
) {
  const prevRef = useRef<Map<string, SessionSummary>>(new Map());
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const prev = prevRef.current;
    const enabled = permission === 'granted';
    const justEnabled = enabled && !prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (enabled) {
      for (const session of sessions) {
        const old = prev.get(session.id);

        if (justEnabled || !old) {
          if (session.needsAttention) {
            if (!notify('Needs your attention', session.title, `attention-${session.id}`)) {
              onUnavailable?.();
              break;
            }
          } else if (session.isTaskComplete) {
            if (!notify('Task complete', session.title, `done-${session.id}`)) {
              onUnavailable?.();
              break;
            }
          }
        } else {
          if (!old.needsAttention && session.needsAttention) {
            if (!notify('Needs your attention', session.title, `attention-${session.id}`)) {
              onUnavailable?.();
              break;
            }
          } else if (!old.isTaskComplete && session.isTaskComplete) {
            if (!notify('Task complete', session.title, `done-${session.id}`)) {
              onUnavailable?.();
              break;
            }
          }
        }
      }
    }

    // Always track state so transitions are detected regardless of enabled
    prevRef.current = new Map(sessions.map((s) => [s.id, s]));
  }, [sessions, permission, onUnavailable]);
}
