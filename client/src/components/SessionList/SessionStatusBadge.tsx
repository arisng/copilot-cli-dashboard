import type { SessionSummary } from '../../api/client.ts';
import { AttentionBadge } from './AttentionBadge.tsx';
import { getSessionErrorLabel } from '../../utils/sessionError.ts';

interface SessionStatusBadgeProps {
  session: SessionSummary;
  pulse?: boolean;
  compact?: boolean;
  className?: string;
}

function baseStatusClass(compact: boolean) {
  return compact
    ? 'rounded-full px-2 py-0.5 text-[11px]'
    : 'rounded-full px-2.5 py-1 text-xs';
}

export function SessionStatusBadge({
  session,
  pulse = false,
  compact = false,
  className = '',
}: SessionStatusBadgeProps) {
  const sizeClassName = baseStatusClass(compact);

  if (session.needsAttention) {
    return <AttentionBadge pulse={pulse} className={`${sizeClassName} ${className}`.trim()} />;
  }

  if (session.isPlanPending) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-attention/25 bg-gh-attention/10 font-medium text-gh-attention ${sizeClassName} ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full bg-gh-attention ${pulse ? 'animate-pulse' : ''}`} />
        Plan review
      </span>
    );
  }

  if (session.lastError) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-warning/25 bg-gh-warning/10 font-medium text-gh-warning ${sizeClassName} ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full bg-gh-warning ${pulse ? 'animate-pulse' : ''}`} />
        {getSessionErrorLabel(session.lastError)}
      </span>
    );
  }

  if (session.isWorking) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-active/25 bg-gh-active/10 font-medium text-gh-active ${sizeClassName} ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full bg-gh-active ${pulse ? 'animate-pulse' : ''}`} />
        Working
      </span>
    );
  }

  if (session.isTaskComplete) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-active/20 bg-gh-active/5 font-medium text-gh-active ${sizeClassName} ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gh-active" />
        Task complete
      </span>
    );
  }

  if (session.isAborted) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-border/80 bg-gh-bg/80 font-medium text-gh-muted ${sizeClassName} ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gh-muted" />
        Aborted
      </span>
    );
  }

  if (session.isIdle) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-border/80 bg-gh-bg/80 font-medium text-gh-muted ${sizeClassName} ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gh-muted" />
        Idle
      </span>
    );
  }

  if (!session.isOpen) {
    return (
      <span className={`inline-flex items-center gap-1.5 border border-gh-border/80 bg-gh-bg/80 font-medium text-gh-muted ${sizeClassName} ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gh-muted" />
        Closed
      </span>
    );
  }

  return null;
}
