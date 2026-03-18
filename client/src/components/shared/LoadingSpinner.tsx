export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className ?? 'py-16'}`}>
      <div className="w-6 h-6 border-2 border-gh-border border-t-gh-accent rounded-full animate-spin" />
    </div>
  );
}
