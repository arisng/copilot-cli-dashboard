import { useNavigate } from 'react-router-dom';
import type { SessionSummary, MessagePreview } from '../../api/client.ts';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { AttentionBadge } from './AttentionBadge.tsx';

interface Props {
  session: SessionSummary;
}

function lastPathSegment(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p;
}

function StatusBadge({ session }: { session: SessionSummary }) {
  if (session.needsAttention) return <AttentionBadge />;
  if (session.isPlanPending) return (
    <span className="inline-flex items-center gap-1 text-xs text-gh-attention">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-attention animate-pulse" />
      Plan review
    </span>
  );
  if (session.isWorking) return (
    <span className="inline-flex items-center gap-1 text-xs text-gh-active">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />
      Working
    </span>
  );
  if (session.isTaskComplete) return (
    <span className="inline-flex items-center gap-1 text-xs text-gh-active">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
      Task complete
    </span>
  );
  if (session.isAborted) return (
    <span className="inline-flex items-center gap-1 text-xs text-gh-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
      Aborted
    </span>
  );
  if (session.isIdle) return (
    <span className="inline-flex items-center gap-1 text-xs text-gh-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />
      Idle
    </span>
  );
  if (!session.isOpen) return <span className="text-xs text-gh-muted">Closed</span>;
  return null;
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
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono rounded px-1.5 py-0 border ${meta.border} bg-gh-bg`}>
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
              const entries = [...counts.values()].slice(0, 5);
              const overflow = counts.size - 5;
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

export function SessionCard({ session }: Props) {
  const navigate = useNavigate();
  const previews = session.previewMessages ?? [];
  const lastMessage = previews[previews.length - 1];
  const activeAgents = session.activeSubAgents.filter((a) => !a.isCompleted);

  return (
    <div
      onClick={() => navigate(`/sessions/${session.id}`)}
      className={`
        bg-gh-surface border border-gh-border rounded-lg cursor-pointer
        hover:border-gh-border/80 hover:bg-gh-surface/80 transition-colors
        flex flex-col overflow-hidden
        ${session.needsAttention ? 'border-l-2 border-l-gh-attention' : ''}
      `}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-gh-text font-medium text-sm leading-snug line-clamp-2">
          {session.title}
        </p>
        {/* Meta row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-gh-muted text-xs font-mono" title={session.projectPath}>
            {lastPathSegment(session.projectPath)}
          </span>
          {session.gitBranch && (
            <>
              <span className="text-gh-border text-xs">·</span>
              <span className="text-gh-accent text-xs font-mono truncate max-w-[140px]">
                {session.gitBranch}
              </span>
            </>
          )}
          <span className="text-gh-border text-xs">·</span>
          <span className="text-gh-muted text-xs tabular-nums">
            {formatDuration(session.durationMs)}
          </span>
          <span className="text-gh-border text-xs">·</span>
          <StatusBadge session={session} />
        </div>
      </div>

      {/* Last message bubble */}
      {lastMessage && (
        <div className="border-t border-gh-border/50 px-4 py-2.5">
          <LastMessage message={lastMessage} />
        </div>
      )}

      {/* Footer: sub-agent badges + time */}
      <div className="border-t border-gh-border/50 px-4 py-2 flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeAgents.slice(0, 3).map((agent) => (
            <span
              key={agent.toolCallId}
              className="inline-flex items-center gap-1 text-[10px] font-mono bg-gh-bg border border-gh-border rounded-full px-2 py-0.5 text-gh-accent"
            >
              <span className="w-1 h-1 rounded-full bg-gh-active animate-pulse" />
              {agent.agentDisplayName || agent.agentName}
            </span>
          ))}
          {activeAgents.length > 3 && (
            <span className="text-xs text-gh-muted">+{activeAgents.length - 3}</span>
          )}
          {activeAgents.length === 0 && (
            <span className="text-[10px] text-gh-muted tabular-nums">
              {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <RelativeTime
          timestamp={session.lastActivityAt}
          className="text-gh-muted text-xs tabular-nums shrink-0"
        />
      </div>
    </div>
  );
}
