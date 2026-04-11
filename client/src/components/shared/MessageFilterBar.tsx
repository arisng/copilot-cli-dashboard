import { useEffect, useRef, useState } from 'react';
import type { MessageFilterState, TurnOption } from '../../utils/messageFilters.ts';
import {
  DEFAULT_MESSAGE_FILTER_STATE,
  isFilterActive,
  formatTimeWindowLabel,
} from '../../utils/messageFilters.ts';

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-text">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-gh-muted hover:bg-gh-border hover:text-gh-text"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  );
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  inlineLabel = false,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  inlineLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDocClick(event: MouseEvent) {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleDocClick);
      return () => document.removeEventListener('mousedown', handleDocClick);
    }
  }, [open]);

  function toggleOption(value: string) {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange([...set]);
  }

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div
      ref={containerRef}
      className={`relative flex min-w-0 gap-1 ${inlineLabel ? 'items-center flex-row' : 'flex-col'}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 min-w-[8rem] items-center justify-between gap-2 rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors hover:border-gh-border focus:border-gh-accent focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayText}</span>
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className={`shrink-0 text-gh-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-20 max-h-64 overflow-y-auto rounded-md border border-gh-border bg-gh-bg py-1 shadow-lg ${
            inlineLabel ? 'mt-1' : 'mt-1 min-w-full'
          }`}
          role="listbox"
          style={{
            top: '100%',
            left: inlineLabel ? 0 : undefined,
            minWidth: inlineLabel ? 'max(10rem, 100%)' : undefined,
          }}
        >
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  isSelected ? 'bg-gh-accent/10 text-gh-text' : 'text-gh-muted hover:bg-gh-surface/60 hover:text-gh-text'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-gh-border bg-gh-bg text-gh-accent focus:ring-gh-accent"
                  checked={isSelected}
                  onChange={() => toggleOption(option)}
                />
                <span className="truncate">{option}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MessageFilterBar({
  filters,
  onChange,
  turnOptions,
  availableTools,
}: {
  filters: MessageFilterState;
  onChange: (filters: MessageFilterState) => void;
  turnOptions: TurnOption[];
  availableTools: string[];
}) {
  const active = isFilterActive(filters);

  function toggleParticipant(role: 'user' | 'assistant' | 'task_complete') {
    const set = new Set(filters.participants);
    if (set.has(role)) set.delete(role);
    else set.add(role);
    onChange({ ...filters, participants: [...set] });
  }

  function toggleTool(name: string) {
    const set = new Set(filters.tools);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    onChange({ ...filters, tools: [...set] });
  }

  function clearAll() {
    onChange(DEFAULT_MESSAGE_FILTER_STATE);
  }

  return (
    <div className="shrink-0 border-b border-gh-border bg-gh-surface/30 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">Turn</span>
          <select
            value={filters.turnId ?? ''}
            onChange={(e) => onChange({ ...filters, turnId: e.target.value || null })}
            className="h-8 min-w-[8rem] rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors focus:border-gh-accent focus:outline-none"
          >
            <option value="">All turns</option>
            {turnOptions.map((turn, idx) => (
              <option key={turn.turnId} value={turn.turnId}>
                Turn {idx + 1}: {turn.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">Time</span>
          <select
            value={filters.timeWindow}
            onChange={(e) => onChange({ ...filters, timeWindow: e.target.value as MessageFilterState['timeWindow'] })}
            className="h-8 min-w-[8rem] rounded-md border border-gh-border bg-gh-bg px-2 text-xs text-gh-text transition-colors focus:border-gh-accent focus:outline-none"
          >
            {(['all', '30m', '1h', '6h', '24h'] as const).map((w) => (
              <option key={w} value={w}>{formatTimeWindowLabel(w)}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gh-muted/70">Participants</span>
          <div className="flex gap-1">
            {(['user', 'assistant', 'task_complete'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleParticipant(role)}
                className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
                  filters.participants.includes(role)
                    ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
                    : 'border-gh-border bg-gh-bg text-gh-muted hover:text-gh-text'
                }`}
              >
                {role === 'user' ? 'User' : role === 'assistant' ? 'Agent' : 'Task'}
              </button>
            ))}
          </div>
        </div>

        {availableTools.length > 0 && (
          <MultiSelectDropdown
            label="Tools"
            options={availableTools}
            selected={filters.tools}
            onChange={(tools) => onChange({ ...filters, tools })}
            placeholder="All tools"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...filters, hasToolCall: !filters.hasToolCall })}
            className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
              filters.hasToolCall
                ? 'border-gh-accent/40 bg-gh-accent/10 text-gh-text'
                : 'border-gh-border bg-gh-bg text-gh-muted hover:text-gh-text'
            }`}
          >
            Has tool call
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, hasReasoning: !filters.hasReasoning })}
            className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
              filters.hasReasoning
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                : 'border-gh-border bg-gh-bg text-gh-muted hover:text-gh-text'
            }`}
          >
            Has reasoning
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, hasError: !filters.hasError })}
            className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface ${
              filters.hasError
                ? 'border-gh-attention/40 bg-gh-attention/10 text-gh-attention'
                : 'border-gh-border bg-gh-bg text-gh-muted hover:text-gh-text'
            }`}
          >
            Errors only
          </button>
        </div>

        {active && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto h-8 rounded-md border border-gh-border bg-gh-bg px-2.5 text-xs font-medium text-gh-muted transition-colors hover:text-gh-text focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-surface"
          >
            Clear all
          </button>
        )}
      </div>

      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gh-muted/70">Active:</span>
          {filters.turnId && (
            <FilterChip
              label={`Turn: ${turnOptions.find((t) => t.turnId === filters.turnId)?.label ?? filters.turnId}`}
              onRemove={() => onChange({ ...filters, turnId: null })}
            />
          )}
          {filters.timeWindow !== 'all' && (
            <FilterChip
              label={formatTimeWindowLabel(filters.timeWindow)}
              onRemove={() => onChange({ ...filters, timeWindow: 'all' })}
            />
          )}
          {filters.participants.map((role) => (
            <FilterChip
              key={role}
              label={role === 'user' ? 'User' : role === 'assistant' ? 'Agent' : 'Task complete'}
              onRemove={() => toggleParticipant(role)}
            />
          ))}
          {filters.tools.map((tool) => (
            <FilterChip
              key={tool}
              label={tool}
              onRemove={() => toggleTool(tool)}
            />
          ))}
          {filters.hasToolCall && (
            <FilterChip label="Has tool call" onRemove={() => onChange({ ...filters, hasToolCall: false })} />
          )}
          {filters.hasReasoning && (
            <FilterChip label="Has reasoning" onRemove={() => onChange({ ...filters, hasReasoning: false })} />
          )}
          {filters.hasError && (
            <FilterChip label="Errors only" onRemove={() => onChange({ ...filters, hasError: false })} />
          )}
        </div>
      )}
    </div>
  );
}
