import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionSummary, MessagePreview } from '../../api/client.ts';
import { getProjectLabel } from '../../hooks/useSessionBrowse.ts';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { SessionStatusBadge } from './SessionStatusBadge.tsx';

interface Props {
  session: SessionSummary;
  selected?: boolean;
  onSelectToggle?: () => void;
  isPinned?: boolean;
  onPinToggle?: () => void;
}

function InfoBlock({
  label,
  value,
  secondary,
  mono = false,
}: {
  label: string;
  value: string;
  secondary?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-gh-border/70 bg-gh-bg/70 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">{label}</p>
      <p className={`mt-1 truncate text-xs font-semibold text-gh-text ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </p>
      {secondary && (
        <p className="mt-0.5 truncate text-[11px] text-gh-muted" title={secondary}>
          {secondary}
        </p>
      )}
    </div>
  );
}

// Matches the label + color scheme from MessageBubble.tsx
const TOOL_META: Record<string, { label: string; dot: string; text: string; border: string }> = {
  bash:          { label: 'bash',       dot: 'bg-blue-400',    text: 'text-blue-400',    border: 'border-blue-400/30' },
  edit:          { label: 'edit',       dot: 'bg-yellow-400',  text: 'text-yellow-400',  border: 'border-yellow-400/30' },
  view:          { label: 'read',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  read:          { label: 'read',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  glob:          { label: 'glob',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  grep:          { label: 'grep',       dot: 'bg-purple-400',  text: 'text-purple-400',  border: 'border-purple-400/30' },
  write:         { label: 'write',      dot: 'bg-orange-400',  text: 'text-orange-400',  border: 'border-orange-400/30' },
  task:          { label: 'agent',      dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  task_complete: { label: 'agent',      dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  read_agent:    { label: 'read agent', dot: 'bg-green-400',   text: 'text-green-400',   border: 'border-green-400/30' },
  ask_user:      { label: 'question',   dot: 'bg-pink-400',    text: 'text-pink-400',    border: 'border-pink-400/30' },
  report_intent: { label: 'intent',     dot: 'bg-gray-400',    text: 'text-gray-400',    border: 'border-gray-400/30' },
  web_fetch:     { label: 'web fetch',  dot: 'bg-gh-accent',   text: 'text-gh-accent',   border: 'border-gh-accent/30' },
  web_search:    { label: 'web search', dot: 'bg-gh-accent',   text: 'text-gh-accent',   border: 'border-gh-accent/30' },
};

const DEFAULT_TOOL_META = { label: '', dot: 'bg-gh-accent', text: 'text-gh-accent', border: 'border-gh-accent/30' };

function toolMeta(name: string) {
  if (TOOL_META[name]) return { ...TOOL_META[name] };
  if (name.startsWith('mcp-atlassian-confluence')) return { label: 'confluence', dot: 'bg-blue-400', text: 'text-blue-400', border: 'border-blue-400/30' };
  if (name.startsWith('mcp-atlassian-jira'))       return { label: 'jira',       dot: 'bg-indigo-400', text: 'text-indigo-400', border: 'border-indigo-400/30' };
  return { ...DEFAULT_TOOL_META, label: name.replace(/_/g, ' ') };
}

function ToolChip({ name, count }: { name: string; count?: number }) {
  const meta = toolMeta(name);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${meta.border} bg-gh-bg`}>
      <span className={`w-1 h-1 rounded-full shrink-0 ${meta.dot}`} />
      <span className={meta.text}>{meta.label}</span>
      {count && count > 1 && <span className="text-gh-muted">×{count}</span>}
    </span>
  );
}

function LastMessage({ message }: { message: MessagePreview }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 mt-0.5
        ${isUser ? 'bg-gh-accent/20 text-gh-accent' : 'bg-gh-active/20 text-gh-active'}
      `}>
        {isUser ? 'U' : 'C'}
      </div>

      {/* Bubble */}
      <div className={`
        flex-1 min-w-0 rounded-lg px-2.5 py-1.5
        ${isUser
          ? 'bg-gh-accent/8 border border-gh-accent/15 rounded-tr-sm'
          : 'bg-gh-bg border border-gh-border rounded-tl-sm'
        }
      `}>
        {message.snippet && (
          <p className="text-xs text-gh-muted leading-relaxed line-clamp-2">
            {message.snippet}
            {message.snippet.length >= 120 && '…'}
          </p>
        )}
        {/* Tool chips for assistant messages */}
        {!isUser && message.toolNames && message.toolNames.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${message.snippet ? 'mt-1.5' : ''}`}>
            {(() => {
              // Deduplicate: count occurrences per canonical label
              const counts = new Map<string, { name: string; count: number }>();
              for (const name of message.toolNames!) {
                const label = toolMeta(name).label;
                const existing = counts.get(label);
                if (existing) existing.count++;
                else counts.set(label, { name, count: 1 });
              }
              const entries = [...counts.values()].slice(0, 3);
              const overflow = counts.size - 3;
              return (
                <>
                  {entries.map(({ name, count }) => (
                    <ToolChip key={name} name={name} count={count} />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] text-gh-muted">+{overflow}</span>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export function SessionCard({ session, selected = false, onSelectToggle, isPinned = false, onPinToggle }: Props) {
  const navigate = useNavigate();
  const previews = session.previewMessages ?? [];
  const lastMessage = previews[previews.length - 1];
  const activeAgents = session.activeSubAgents.filter((a) => !a.isCompleted);
  const showPreview = Boolean(lastMessage) && (session.needsAttention || session.lastError || session.isWorking || session.isPlanPending || activeAgents.length > 0);

  function openSession() {
    navigate(`/sessions/${session.id}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSession();
    }
  }

  return (
    <div
      onClick={openSession}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`Open session ${session.title}`}
      className={`
        bg-gh-surface rounded-lg cursor-pointer transition-colors
        flex flex-col overflow-hidden
        focus-visible:bg-gh-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-bg
        ${session.needsAttention
          ? 'border border-gh-attention/60 hover:border-gh-attention/80'
          : session.lastError
          ? 'border border-gh-warning/50 hover:border-gh-warning/70'
          : session.isWorking
          ? 'border border-gh-active/50 hover:border-gh-active/70'
          : 'border border-gh-border hover:border-gh-border/80 hover:bg-gh-surface/80'
        }
        ${selected ? 'ring-2 ring-gh-accent/40 bg-gh-accent/5' : ''}
      `}
    >
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <SessionStatusBadge session={session} pulse={false} />
          <div className="flex items-center gap-2">
            {onPinToggle && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                title={isPinned ? 'Unpin session' : 'Pin session'}
                className={`rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 ${
                  isPinned ? 'text-gh-accent hover:bg-gh-accent/10' : 'text-gh-muted hover:bg-gh-accent/10 hover:text-gh-accent'
                }`}
              >
                {isPinned ? (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M3 3a2 2 0 012-2h6a2 2 0 012 2v10.5a.5.5 0 01-.78.42l-5.22-3.48-5.22 3.48A.5.5 0 011 13.5V3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3a2 2 0 012-2h6a2 2 0 012 2v10.5a.5.5 0 01-.78.42l-5.22-3.48-5.22 3.48A.5.5 0 011 13.5V3z" />
                  </svg>
                )}
              </button>
            )}
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelectToggle?.();
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select session ${session.title}`}
              className="h-4 w-4 rounded border-gh-border bg-gh-bg text-gh-accent focus:ring-gh-accent/40"
            />
            <RelativeTime
              timestamp={session.lastActivityAt}
              className="shrink-0 text-xs font-semibold tabular-nums text-gh-text/85"
            />
          </div>
        </div>

        <p className="mt-2 text-gh-text text-sm font-semibold leading-5 line-clamp-2">
          {session.title}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <InfoBlock
            label="Project"
            value={getProjectLabel(session.projectPath)}
            secondary={session.gitBranch ?? 'No git branch'}
            mono
          />
          <InfoBlock
            label="Activity"
            value={formatDuration(session.durationMs)}
            secondary={activeAgents.length > 0
              ? `${activeAgents.length} active agent${activeAgents.length === 1 ? '' : 's'}`
              : `${session.messageCount} msg${session.messageCount === 1 ? '' : 's'}`}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ModeBadge mode={session.currentMode} className="rounded-full px-2 py-0.5 text-[10px]" />
          {session.model && (
            <span className="inline-flex max-w-full items-center truncate rounded-full border border-gh-border/70 bg-gh-bg/70 px-2 py-0.5 text-[11px] font-mono text-gh-muted" title={session.model}>
              {session.model}
            </span>
          )}
        </div>
      </div>

      {/* Last message bubble */}
      {showPreview && lastMessage && (
        <div className="border-t border-gh-border/50 px-4 py-2">
          <LastMessage message={lastMessage} />
        </div>
      )}

      {activeAgents.length > 0 && (
        <div className="mt-auto border-t border-gh-border/50 px-4 py-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gh-muted/70">
            Active sub-agents
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeAgents.slice(0, 2).map((agent) => (
            <span
              key={agent.toolCallId}
              className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-bg px-2 py-0.5 text-[10px] font-mono text-gh-accent"
            >
              <span className="w-1 h-1 rounded-full bg-gh-active animate-pulse" />
              {agent.agentDisplayName || agent.agentName}
            </span>
            ))}
            {activeAgents.length > 2 && (
              <span className="text-[11px] text-gh-muted">+{activeAgents.length - 2} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
