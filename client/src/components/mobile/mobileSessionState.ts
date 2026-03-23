import type { SessionSummary } from '../../api/client.ts';

type SessionStateSource = Pick<
  SessionSummary,
  'needsAttention' | 'isWorking' | 'isIdle' | 'isTaskComplete' | 'isAborted' | 'isOpen'
>;

interface MobileSessionState {
  label: string;
  className: string;
}

export function getMobileSessionState(session: SessionStateSource): MobileSessionState {
  if (session.needsAttention) {
    return {
      label: 'Needs attention',
      className: 'border-gh-attention/40 bg-gh-attention/10 text-gh-attention',
    };
  }

  if (session.isAborted) {
    return {
      label: 'Aborted',
      className: 'border-red-500/40 bg-red-500/10 text-red-300',
    };
  }

  if (session.isWorking) {
    return {
      label: 'Working',
      className: 'border-gh-active/40 bg-gh-active/10 text-gh-active',
    };
  }

  if (session.isTaskComplete) {
    return {
      label: 'Task complete',
      className: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    };
  }

  if (session.isIdle) {
    return {
      label: 'Idle',
      className: 'border-gh-border bg-gh-surface text-gh-muted',
    };
  }

  if (!session.isOpen) {
    return {
      label: 'Closed',
      className: 'border-gh-border bg-gh-surface text-gh-muted',
    };
  }

  return {
    label: 'Monitoring',
    className: 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent',
  };
}
