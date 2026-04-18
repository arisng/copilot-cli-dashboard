import type { SessionSummary } from '../../api/client.ts';

interface SourceBadgeProps {
  source: SessionSummary['source'];
  compact?: boolean;
  className?: string;
}

const SOURCE_META = {
  cli: {
    label: 'CLI',
    icon: (
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.5 10.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM3.844 5.792a.75.75 0 010 1.06L2.155 8.54l1.69 1.688a.75.75 0 11-1.06 1.06l-2.22-2.22a.75.75 0 010-1.06l2.22-2.22a.75.75 0 011.06 0zm3.138 1.06a.75.75 0 011.06-1.06l2.22 2.22a.75.75 0 010 1.06l-2.22 2.22a.75.75 0 11-1.06-1.06l1.69-1.688-1.69-1.688z" />
      </svg>
    ),
    border: 'border-gh-accent/25',
    bg: 'bg-gh-accent/10',
    text: 'text-gh-accent',
  },
  vscode: {
    label: 'VS Code',
    icon: (
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M4.72.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L5.78 9.78a.75.75 0 01-1.06-1.06L8.44 5 4.72 1.28a.75.75 0 010-1.06zM11.28.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L13.94 4l-2.66-2.72a.75.75 0 010-1.06zM.72 1.28A.75.75 0 011.78.22l4.25 4.25a.75.75 0 010 1.06L1.78 9.78a.75.75 0 01-1.06-1.06L4.44 5 .72 1.28z" />
      </svg>
    ),
    border: 'border-gh-vscode/25',
    bg: 'bg-gh-vscode/10',
    text: 'text-gh-vscode',
  },
};

export function SourceBadge({ source, compact = false, className = '' }: SourceBadgeProps) {
  if (!source) return null;

  const meta = SOURCE_META[source];
  if (!meta) return null;

  const sizeClass = compact
    ? 'rounded-full px-2 py-0.5 text-[11px]'
    : 'rounded-full px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium ${meta.border} ${meta.bg} ${meta.text} ${sizeClass} ${className}`}
      title={source === 'cli' ? 'Copilot CLI session' : 'VS Code Copilot Chat session'}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}
