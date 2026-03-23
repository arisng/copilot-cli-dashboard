import type { SessionBrowseSortField, SessionBrowseSortOrder } from '../../hooks/useSessionBrowse.ts';

type BrowseControlSize = 'default' | 'mobile';

interface BrowseSelectOption {
  value: string;
  label: string;
}

interface BrowseSelectProps {
  label: string;
  value: string;
  options: BrowseSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: BrowseControlSize;
}

interface BrowseSortOrderToggleProps {
  value: SessionBrowseSortOrder;
  onChange: (value: SessionBrowseSortOrder) => void;
  size?: BrowseControlSize;
}

interface BrowsePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
  size?: BrowseControlSize;
}

export const SESSION_BROWSE_SORT_FIELD_LABELS: Record<SessionBrowseSortField, string> = {
  last_activity: 'Last activity',
  session_time: 'Session time',
  api_time_spent: 'API time spent',
  total_premium_requests_usage_est: 'Premium requests est',
};

export function BrowseSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  size = 'default',
}: BrowseSelectProps) {
  const labelClassName = size === 'mobile'
    ? 'text-[11px] font-medium uppercase tracking-[0.22em] text-gh-muted'
    : 'text-[11px] font-medium uppercase tracking-wide text-gh-muted/70';
  const selectClassName = size === 'mobile'
    ? 'min-h-[48px] min-w-0 rounded-2xl border border-gh-border bg-gh-bg px-3.5 text-sm text-gh-text transition-colors focus:border-gh-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
    : 'h-8 min-w-0 rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors focus:border-gh-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClassName}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={selectClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BrowseSortOrderToggle({
  value,
  onChange,
  size = 'default',
}: BrowseSortOrderToggleProps) {
  if (size === 'mobile') {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-gh-muted">
          Order
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(['desc', 'asc'] as const).map((order) => {
            const isActive = order === value;

            return (
              <button
                key={order}
                type="button"
                onClick={() => onChange(order)}
                className={`min-h-[44px] rounded-2xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
                    : 'border-gh-border bg-gh-bg text-gh-muted hover:border-gh-border/80 hover:text-gh-text'
                }`}
              >
                {order.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">
        Order
      </span>
      <div className="flex overflow-hidden rounded-md border border-gh-border bg-gh-bg">
        {(['desc', 'asc'] as const).map((order) => {
          const isActive = order === value;

          return (
            <button
              key={order}
              type="button"
              onClick={() => onChange(order)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-gh-surface text-gh-text'
                  : 'text-gh-muted hover:bg-gh-surface/50 hover:text-gh-text'
              }`}
            >
              {order.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BrowsePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  compact = false,
  size = 'default',
}: BrowsePaginationProps) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  const summaryClassName = size === 'mobile'
    ? 'text-xs'
    : compact
      ? 'text-[11px]'
      : 'text-xs';
  const buttonClassName = size === 'mobile'
    ? 'min-h-[44px] rounded-2xl border border-gh-border bg-gh-bg px-3.5 py-2 text-sm text-gh-text transition-colors hover:bg-gh-surface disabled:cursor-not-allowed disabled:opacity-50'
    : `${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} rounded-md border border-gh-border bg-gh-bg text-gh-text transition-colors hover:bg-gh-surface disabled:cursor-not-allowed disabled:opacity-50`;
  const containerClassName = size === 'mobile'
    ? 'flex flex-col gap-3'
    : 'flex items-center justify-between gap-3';
  const buttonContainerClassName = size === 'mobile'
    ? 'grid grid-cols-2 gap-2'
    : 'flex items-center gap-1';

  return (
    <div className={containerClassName}>
      <div className={`${summaryClassName} text-gh-muted`}>
        {totalItems === 0 ? (
          '0 results'
        ) : (
          <>
            {start}-{end} of {totalItems}
            <span className="text-gh-muted/60"> · Page {page}/{totalPages}</span>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className={buttonContainerClassName}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={buttonClassName}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={buttonClassName}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
