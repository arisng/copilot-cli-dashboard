// Shared mode badge + styling helpers used across session list and detail views.
// Claude Code emits "autopilot" | "plan" | "interactive" from session.mode_changed events.

export function isAutopilot(mode: string) {
  return mode === 'autopilot' || mode === 'auto';
}

export function isPlanMode(mode: string) {
  return mode === 'plan';
}

export function isNonInteractive(mode: string) {
  return mode && mode !== 'interactive';
}

/** Border class for the chat card based on current mode. */
export function modeBorderClass(mode: string): string {
  if (isAutopilot(mode)) return 'border-green-400/30';
  if (isPlanMode(mode))  return 'border-sky-400/30';
  if (isNonInteractive(mode)) return 'border-gray-500/30';
  return 'border-gh-border';
}

export function ModeBadge({ mode, className = '' }: { mode: string; className?: string }) {
  if (!mode || mode === 'interactive') return null;

  if (isAutopilot(mode)) return (
    <span className={`inline-flex items-center text-[10px] font-mono border border-green-400/30 rounded px-1.5 py-0 text-green-400 bg-green-400/5 ${className}`}>
      autopilot
    </span>
  );

  if (isPlanMode(mode)) return (
    <span className={`inline-flex items-center text-[10px] font-mono border border-sky-400/30 rounded px-1.5 py-0 text-sky-400 bg-sky-400/5 ${className}`}>
      plan mode
    </span>
  );

  return (
    <span className={`inline-flex items-center text-[10px] font-mono border border-gray-500/30 rounded px-1.5 py-0 text-gray-400 bg-gray-400/5 ${className}`}>
      {mode}
    </span>
  );
}
