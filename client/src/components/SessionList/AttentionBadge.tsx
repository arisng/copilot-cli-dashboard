export function AttentionBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gh-attention/15 text-gh-attention border border-gh-attention/30">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-attention animate-pulse" />
      Needs attention
    </span>
  );
}
