import type { ReactNode } from 'react';

type MobileInfoCardVariant = 'bordered' | 'subtle';

interface MobileInfoCardProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  variant?: MobileInfoCardVariant;
}

const variantClasses: Record<MobileInfoCardVariant, string> = {
  bordered: 'border border-gh-border/70 bg-gh-bg/70 p-3',
  subtle: 'bg-gh-bg/80 p-2',
};

export function MobileInfoCard({
  label,
  value,
  valueClassName = 'text-sm font-medium text-gh-text',
  variant = 'bordered',
}: MobileInfoCardProps) {
  return (
    <div className={`rounded-xl ${variantClasses[variant]}`}>
      <p className="text-[11px] uppercase tracking-wide text-gh-muted">{label}</p>
      <div className={`mt-1 ${valueClassName}`}>{value}</div>
    </div>
  );
}
