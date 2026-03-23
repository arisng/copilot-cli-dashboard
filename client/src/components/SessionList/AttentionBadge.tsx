interface AttentionBadgeProps {
  pulse?: boolean;
  className?: string;
}

export function AttentionBadge({ pulse = true, className = '' }: AttentionBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-gh-attention/30 bg-gh-attention/15 px-2 py-0.5 text-xs font-medium text-gh-attention ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-gh-attention ${pulse ? 'animate-pulse' : ''}`} />
      Needs attention
    </span>
  );
}
