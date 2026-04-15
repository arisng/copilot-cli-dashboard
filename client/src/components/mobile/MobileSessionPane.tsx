import { type ReactNode, useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveSubAgent, ParsedMessage, SessionDetail, TodoItem, ToolRequest, SessionArtifactEntry, SessionArtifactGroup, SessionArtifacts } from '../../api/client.ts';
import { useSession } from '../../hooks/useSession.ts';
import { fetchSessionArtifacts } from '../../api/client.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { FileTree } from '../SessionDetail/FileTree.tsx';
import { ImagePreview } from '../SessionDetail/ImagePreview.tsx';
import { isImageFile } from '../../utils/fileUtils.ts';
import { ArtifactViewer } from '../shared/ArtifactViewer';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { MobileInfoCard } from './MobileInfoCard.tsx';
import { getMobileSessionState } from './mobileSessionState.ts';
import { getSessionErrorDescription, getSessionErrorLabel } from '../../utils/sessionError.ts';
import {
  MOBILE_MESSAGE_SNIPPET_MAX_LENGTH,
  getMessageSnippet,
  getMobileSubAgentLabel,
  getProjectName,
  getTodoTone,
  titleCaseMobileLabel,
  truncateMobileText,
} from './mobileSessionViewModels.ts';
import { sortTodosLatestFirst } from '../../utils/todoSort.ts';
import {
  type MessageFilterState,
  DEFAULT_MESSAGE_FILTER_STATE,
  getMessageTools,
  buildTurnOptions,
  applyMessageFilters,
} from '../../utils/messageFilters.ts';
import { MessageFilterBar } from '../shared/MessageFilterBar.tsx';
import {
  MobileToolBlock,
  MobileReasoningBlock,
} from './MobileToolBlocks.tsx';

const MOBILE_VISIBLE_MESSAGES = 10;

type DetailSectionId = 'overview' | 'activity' | 'work' | 'agents' | 'checkpoints' | 'research' | 'files';

interface DetailTab {
  id: DetailSectionId;
  label: string;
  badge?: string;
  count?: number;
}

interface MessageStream {
  id: string;
  label: string;
  description: string;
  messages: ParsedMessage[];
  isSubAgent: boolean;
  isCompleted?: boolean;
}

const MESSAGE_ROLE_TONES: Record<ParsedMessage['role'], string> = {
  user: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  assistant: 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent',
  task_complete: 'border-gh-active/30 bg-gh-active/10 text-gh-active',
};

const TODO_STATUS_CONFIG: Record<string, { label: string; dot: string; accent: string; border: string }> = {
  completed: { label: 'Done', dot: 'bg-gh-active', accent: 'text-gh-active', border: 'border-gh-active/20' },
  done: { label: 'Done', dot: 'bg-gh-active', accent: 'text-gh-active', border: 'border-gh-active/20' },
  in_progress: {
    label: 'In progress',
    dot: 'bg-gh-accent animate-pulse',
    accent: 'text-gh-accent',
    border: 'border-gh-accent/20',
  },
  pending: { label: 'Pending', dot: 'bg-gh-muted', accent: 'text-gh-muted', border: 'border-gh-border' },
  cancelled: { label: 'Cancelled', dot: 'bg-gh-muted', accent: 'text-gh-muted', border: 'border-gh-border' },
  blocked: {
    label: 'Blocked',
    dot: 'bg-gh-attention',
    accent: 'text-gh-attention',
    border: 'border-gh-attention/20',
  },
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = sizeBytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function collectArtifactFiles(entries: SessionArtifactEntry[]): SessionArtifactEntry[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'file') {
      return [entry];
    }
    return collectArtifactFiles(entry.children ?? []);
  });
}

function isDoneStatus(status: string) {
  return status === 'done' || status === 'completed' || status === 'cancelled';
}

function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function getSessionCallout(session: SessionDetail, todoCount: number, activeAgents: number, completedAgents: number) {
  if (session.needsAttention) {
    return {
      title: 'Needs attention',
      description: 'This session is likely waiting for user input, approval, or a blocked tool response.',
      toneClass: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
    };
  }

  if (session.isPlanPending) {
    return {
      title: 'Plan ready for review',
      description: 'Open the work section to review the captured plan and decide how the session should proceed.',
      toneClass: 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention',
    };
  }

  if (session.lastError) {
    return {
      title: getSessionErrorLabel(session.lastError),
      description: getSessionErrorDescription(session.lastError),
      toneClass: 'border-gh-warning/30 bg-gh-warning/10 text-gh-warning',
    };
  }

  if (session.isWorking) {
    return {
      title: 'Actively working',
      description:
        activeAgents > 0
          ? `${pluralize(activeAgents, 'sub-agent')} are visible alongside the main conversation.`
          : todoCount > 0
            ? `${pluralize(todoCount, 'todo')} are tracking progress for this run.`
            : 'The main conversation is still progressing with recent activity.',
      toneClass: 'border-gh-active/30 bg-gh-active/10 text-gh-active',
    };
  }

  if (session.isTaskComplete) {
    return {
      title: 'Task complete',
      description:
        completedAgents > 0
          ? `The session reported completion and ${pluralize(completedAgents, 'sub-agent')} also finished.`
          : 'The session reported completion and is ready for a quick review.',
      toneClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    };
  }

  if (session.isAborted) {
    return {
      title: 'Aborted',
      description: 'The run stopped before completion. Review recent activity below for the latest context.',
      toneClass: 'border-red-500/30 bg-red-500/10 text-red-300',
    };
  }

  if (session.isIdle) {
    return {
      title: 'Idle',
      description: 'No recent updates are arriving. The captured history below is still available for inspection.',
      toneClass: 'border-gh-border bg-gh-bg/70 text-gh-text',
    };
  }

  if (!session.isOpen) {
    return {
      title: 'Closed',
      description: 'This session is no longer open, but its messages, plan, todos, and agents remain available.',
      toneClass: 'border-gh-border bg-gh-bg/70 text-gh-text',
    };
  }

  return {
    title: 'Monitoring',
    description:
      activeAgents > 0
        ? `${pluralize(activeAgents, 'sub-agent')} are visible while the session remains open.`
        : 'This session is being monitored and will refresh automatically.',
    toneClass: 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent',
  };
}

function MobileSectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gh-border bg-gh-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gh-text">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs leading-relaxed text-gh-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}



function MobileMessageCard({ message }: { message: ParsedMessage }) {
  const hasContent = message.content.trim().length > 0;
  const hasReasoning = Boolean(message.reasoning?.trim());
  const hasTools = (message.toolRequests?.length ?? 0) > 0;
  const isTaskComplete = message.role === 'task_complete';

  // For assistant messages with tools but no content, show "Using tools…"
  const showUsingToolsIndicator = message.role === 'assistant' && !hasContent && hasTools;

  return (
    <article className="rounded-2xl border border-gh-border bg-gh-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${MESSAGE_ROLE_TONES[message.role]}`}
          >
            {titleCaseMobileLabel(message.role)}
          </span>
          {hasTools ? (
            <span className="text-[11px] text-gh-muted">{pluralize(message.toolRequests!.length, 'tool call')}</span>
          ) : null}
        </div>
        <RelativeTime timestamp={message.timestamp} className="shrink-0 text-xs text-gh-muted" />
      </div>

      {/* Reasoning block */}
      {hasReasoning && <div className="mt-3"><MobileReasoningBlock text={message.reasoning!} /></div>}

      {/* Content with Markdown rendering */}
      {hasContent ? (
        <div className="mt-3 text-sm text-gh-text">
          {isTaskComplete ? (
            <div className="text-xs font-semibold text-gh-active mb-2 uppercase tracking-wide">Task complete</div>
          ) : null}
          <MarkdownRenderer content={message.content} variant="message" />
        </div>
      ) : showUsingToolsIndicator ? (
        <p className="mt-3 text-gh-muted text-xs italic">Using tools…</p>
      ) : null}

      {/* Tool blocks */}
      {hasTools ? (
        <div className="mt-3 space-y-1.5">
          {message.toolRequests!.map((tool) => (
            <MobileToolBlock key={tool.toolCallId} tool={tool} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TodoCard({ todo }: { todo: TodoItem }) {
  const statusConfig = TODO_STATUS_CONFIG[todo.status] ?? TODO_STATUS_CONFIG.pending;
  const descriptionPreview = truncateMobileText(todo.description ?? '', 150);
  const hasExpandableContent = (todo.description ?? '').trim().length > descriptionPreview.length || (todo.dependsOn ?? []).length > 0;
  const cardBody = (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusConfig.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-gh-text">{todo.title}</p>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${getTodoTone(todo)}`}>
            {statusConfig.label}
          </span>
        </div>

        {todo.description ? <p className="mt-2 text-xs leading-relaxed text-gh-muted">{descriptionPreview}</p> : null}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gh-muted">
          <span className="font-mono">{todo.id}</span>
          <span className="text-gh-border">·</span>
          <span className="inline-flex items-center gap-1">
            Updated
            <RelativeTime timestamp={todo.updatedAt} className="text-[11px] text-gh-muted" />
          </span>
          {(todo.dependsOn ?? []).length > 0 ? (
            <>
              <span className="text-gh-border">·</span>
              <span>{pluralize((todo.dependsOn ?? []).length, 'dependency', 'dependencies')}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!hasExpandableContent) {
    return <div className={`rounded-xl border bg-gh-bg/70 p-4 ${statusConfig.border}`}>{cardBody}</div>;
  }

  return (
    <details
      open={todo.status === 'in_progress' || todo.status === 'blocked'}
      className={`group rounded-xl border bg-gh-bg/70 ${statusConfig.border}`}
    >
      <summary className="list-none cursor-pointer p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">{cardBody}</div>
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="currentColor"
            className="mt-1 shrink-0 text-gh-muted transition-transform group-open:rotate-90"
          >
            <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        </div>
      </summary>

      <div className="space-y-3 border-t border-gh-border/60 px-4 py-3">
        {todo.description ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gh-muted">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gh-text">{todo.description}</p>
          </div>
        ) : null}

        {(todo.dependsOn ?? []).length > 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gh-muted">Dependencies</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(todo.dependsOn ?? []).map((dependency) => (
                <span
                  key={`${todo.id}-${dependency}`}
                  className="rounded-full border border-gh-border bg-gh-surface px-2 py-1 text-[11px] font-mono text-gh-muted"
                >
                  {dependency}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MobileSubAgentCard({
  agent,
  messages,
  onOpenThread,
}: {
  agent: ActiveSubAgent;
  messages: ParsedMessage[];
  onOpenThread: () => void;
}) {
  const isRunning = !agent.isCompleted;
  const latestMessage = messages[messages.length - 1];
  const preview = latestMessage
    ? truncateMobileText(getMessageSnippet(latestMessage), 150)
    : 'No captured messages yet for this thread.';

  return (
    <details open={isRunning} className="group rounded-xl border border-gh-border bg-gh-bg/70">
      <summary className="list-none cursor-pointer p-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isRunning ? 'bg-gh-active animate-pulse' : 'bg-gh-muted'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-gh-text">{getMobileSubAgentLabel(agent)}</p>
                {agent.description && agent.agentName !== 'read_agent' ? (
                  <p className="mt-1 text-xs leading-relaxed text-gh-muted">{agent.description}</p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${
                  isRunning
                    ? 'border-gh-active/30 bg-gh-active/10 text-gh-active'
                    : 'border-gh-border bg-gh-surface text-gh-muted'
                }`}
              >
                {isRunning ? 'Running' : 'Done'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gh-muted">
              <span>{pluralize(messages.length, 'message')}</span>
              {latestMessage ? (
                <>
                  <span className="text-gh-border">·</span>
                  <span>Updated {formatAbsoluteTime(latestMessage.timestamp)}</span>
                </>
              ) : null}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-gh-muted">{preview}</p>
          </div>

          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="currentColor"
            className="mt-1 shrink-0 text-gh-muted transition-transform group-open:rotate-90"
          >
            <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        </div>
      </summary>

      <div className="space-y-3 border-t border-gh-border/60 px-4 py-3">
        <button
          type="button"
          onClick={onOpenThread}
          className="inline-flex items-center rounded-xl border border-gh-border bg-gh-surface px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
        >
          Open thread in Activity
        </button>

        {messages.length > 0 ? (
          <div className="space-y-2">
            {[...messages].reverse().slice(0, 2).map((message) => (
              <div key={message.id} className="rounded-xl border border-gh-border/70 bg-gh-surface/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-wide text-gh-muted">
                    {titleCaseMobileLabel(message.role)}
                  </span>
                  <RelativeTime timestamp={message.timestamp} className="text-[11px] text-gh-muted" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gh-text">
                  {truncateMobileText(getMessageSnippet(message), 130)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gh-muted">No thread messages are available for this sub-agent yet.</p>
        )}
      </div>
    </details>
  );
}

function OverviewPanel({
  session,
  projectName,
  todos,
  onNavigate,
}: {
  session: SessionDetail;
  projectName: string;
  todos: TodoItem[];
  onNavigate: (section: DetailSectionId) => void;
}) {
  const activeTodos = todos.filter((todo) => todo.status === 'in_progress').length;
  const blockedTodos = todos.filter((todo) => todo.status === 'blocked').length;
  const doneTodos = todos.filter((todo) => isDoneStatus(todo.status)).length;
  const activeAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
  const completedAgents = session.activeSubAgents.length - activeAgents;
  const callout = getSessionCallout(session, todos.length, activeAgents, completedAgents);
  const highlights = [
    session.isPlanPending
      ? 'A plan is waiting for review in the Work section.'
      : session.hasPlan
        ? 'A captured plan is available for quick mobile review.'
        : 'No plan content has been captured for this session yet.',
    todos.length > 0
      ? `${pluralize(activeTodos, 'active todo')} and ${pluralize(blockedTodos, 'blocked todo')} are currently visible.`
      : 'No todo items are attached to this session yet.',
    session.activeSubAgents.length > 0
      ? `${pluralize(activeAgents, 'running sub-agent')} and ${pluralize(completedAgents, 'completed sub-agent')} are available.`
      : 'No sub-agent threads have been recorded for this session.',
  ];

  return (
    <div className="space-y-4">
      <MobileSectionCard title={callout.title} subtitle={callout.description}>
        <div className={`rounded-2xl border p-3 ${callout.toneClass}`}>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Session pulse</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MobileInfoCard
              label="Started"
              value={formatAbsoluteTime(session.startedAt)}
              valueClassName="text-sm text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="Last seen"
              value={formatAbsoluteTime(session.lastActivityAt)}
              valueClassName="text-sm text-gh-text"
              variant="subtle"
            />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {highlights.map((highlight) => (
            <div key={highlight} className="flex items-start gap-2 rounded-xl border border-gh-border/70 bg-gh-bg/70 px-3 py-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gh-accent" />
              <p className="text-sm leading-relaxed text-gh-text">{highlight}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="rounded-xl border border-gh-border bg-gh-bg px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
          >
            Open activity
          </button>
          {session.hasPlan || session.isPlanPending || todos.length > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate('work')}
              className="rounded-xl border border-gh-border bg-gh-bg px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
            >
              Review work
            </button>
          ) : null}
          {session.activeSubAgents.length > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              className="rounded-xl border border-gh-border bg-gh-bg px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
            >
              Inspect agents
            </button>
          ) : null}
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Metadata" subtitle="Core session identifiers and context.">
        <div className="space-y-2">
          <MobileInfoCard
            label="Project"
            value={
              <div>
                <p className="text-sm font-medium text-gh-text">{projectName}</p>
                <p className="mt-1 break-all text-xs text-gh-muted">{session.projectPath}</p>
              </div>
            }
            valueClassName="text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <MobileInfoCard
              label="Branch"
              value={
                session.gitBranch ? (
                  <span className="break-all font-mono text-xs text-gh-accent">{session.gitBranch}</span>
                ) : (
                  'No branch'
                )
              }
              valueClassName="text-sm text-gh-text"
            />
            <MobileInfoCard
              label="Model"
              value={session.model ?? 'Unknown'}
              valueClassName="text-sm text-gh-text"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MobileInfoCard
              label="Todo progress"
              value={`${doneTodos}/${todos.length || 0}`}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="Sub-agent threads"
              value={session.activeSubAgents.length}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
          </div>
        </div>
      </MobileSectionCard>
    </div>
  );
}

function ActivityPanel({
  session,
  streams,
  activeStreamId,
  onStreamChange,
}: {
  session: SessionDetail;
  streams: MessageStream[];
  activeStreamId: string;
  onStreamChange: (streamId: string) => void;
}) {
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [filters, setFilters] = useState<MessageFilterState>(DEFAULT_MESSAGE_FILTER_STATE);
  const activeStream = streams.find((stream) => stream.id === activeStreamId) ?? streams[0];

  const isMainStream = activeStream.id === 'main';
  const turnOptions = useMemo(() => buildTurnOptions(session.messages), [session.messages]);
  const availableTools = useMemo(() => getMessageTools(session.messages), [session.messages]);

  const filteredMessages = useMemo(() => {
    if (!isMainStream) return activeStream.messages;
    const result = applyMessageFilters(activeStream.messages, filters, turnOptions);
    return filters.turnId ? [...result].reverse() : result;
  }, [activeStream.messages, filters, isMainStream, turnOptions]);

  const totalToolCalls = filteredMessages.reduce((total, message) => total + (message.toolRequests?.length ?? 0), 0);
  const visibleMessages = showAllMessages
    ? filteredMessages
    : filteredMessages.slice(0, MOBILE_VISIBLE_MESSAGES);
  const hiddenCount = Math.max(0, filteredMessages.length - visibleMessages.length);

  useEffect(() => {
    setShowAllMessages(false);
  }, [activeStreamId]);

  return (
    <div className="space-y-4">
      <MobileSectionCard
        title="Activity streams"
        subtitle="Switch between the main conversation and any sub-agent threads. Newest updates appear first."
      >
        {streams.length > 1 ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex w-max min-w-full gap-2">
              {streams.map((stream) => {
                const isActive = stream.id === activeStream.id;
                return (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => onStreamChange(stream.id)}
                    className={`min-w-[120px] rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-gh-accent/40 bg-gh-bg text-gh-text'
                        : 'border-gh-border bg-gh-surface/70 text-gh-muted hover:border-gh-accent/30 hover:text-gh-text'
                    }`}
                  >
                    <span className="block text-xs font-semibold">
                      {truncateMobileText(stream.label, 18)}
                    </span>
                    <span className="mt-1 block text-[11px] text-gh-muted">
                      {pluralize(stream.messages.length, 'message')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-gh-border/70 bg-gh-bg/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gh-text">{activeStream.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-gh-muted">{activeStream.description}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${
                activeStream.isSubAgent
                  ? activeStream.isCompleted
                    ? 'border-gh-border bg-gh-surface text-gh-muted'
                    : 'border-gh-active/30 bg-gh-active/10 text-gh-active'
                  : 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent'
              }`}
            >
              {activeStream.isSubAgent ? (activeStream.isCompleted ? 'Done' : 'Running') : 'Main'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MobileInfoCard
              label="Messages"
              value={filteredMessages.length}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="Tools"
              value={totalToolCalls}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="Last update"
              value={
                filteredMessages.length > 0 ? (
                  <RelativeTime timestamp={filteredMessages[0].timestamp} className="text-sm text-gh-text" />
                ) : (
                  <RelativeTime timestamp={session.lastActivityAt} className="text-sm text-gh-text" />
                )
              }
              valueClassName="text-sm text-gh-text"
              variant="subtle"
            />
          </div>
        </div>
      </MobileSectionCard>

      {isMainStream && (
        <div className="rounded-2xl border border-gh-border bg-gh-surface p-0">
          <MessageFilterBar
            filters={filters}
            onChange={setFilters}
            turnOptions={turnOptions}
            availableTools={availableTools}
          />
        </div>
      )}

      <MobileSectionCard
        title="Messages"
        subtitle={
          filteredMessages.length > 0
            ? `${pluralize(filteredMessages.length, 'message')} in this stream.`
            : 'No messages have been captured in this stream yet.'
        }
      >
        {filteredMessages.length === 0 ? (
          <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
            No messages match the current filters.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleMessages.map((message) => (
                <MobileMessageCard key={message.id} message={message} />
              ))}
            </div>

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAllMessages((value) => !value)}
                className="mt-4 w-full rounded-xl border border-gh-border bg-gh-bg px-3 py-2.5 text-sm font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
              >
                {showAllMessages ? 'Show fewer messages' : `Show ${hiddenCount} older messages`}
              </button>
            ) : null}
          </>
        )}
      </MobileSectionCard>
    </div>
  );
}

function WorkPanel({ session, todos }: { session: SessionDetail; todos: TodoItem[] }) {
  const hasPlan = session.isPlanPending || Boolean(session.planContent ?? '');
  const sortedTodos = sortTodosLatestFirst(todos);
  const todoGroups = [
    { label: 'In progress', items: sortedTodos.filter((todo) => todo.status === 'in_progress'), accent: 'text-gh-accent' },
    { label: 'Blocked', items: sortedTodos.filter((todo) => todo.status === 'blocked'), accent: 'text-gh-attention' },
    { label: 'Pending', items: sortedTodos.filter((todo) => todo.status === 'pending'), accent: 'text-gh-muted' },
    { label: 'Done', items: sortedTodos.filter((todo) => isDoneStatus(todo.status)), accent: 'text-gh-muted' },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      <MobileSectionCard
        title="Plan"
        subtitle={
          session.isPlanPending
            ? 'A plan is waiting for review.'
            : hasPlan
              ? 'Captured plan content for this session.'
              : 'No plan content has been captured.'
        }
      >
        {hasPlan ? (
          <details open={session.isPlanPending || todos.length === 0} className="group rounded-2xl border border-gh-border bg-gh-bg/70">
            <summary className="list-none cursor-pointer p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        session.isPlanPending
                          ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention'
                          : 'border-gh-active/30 bg-gh-active/10 text-gh-active'
                      }`}
                    >
                      {session.isPlanPending ? 'Waiting for approval' : 'Captured plan'}
                    </span>
                    <span className="text-[11px] text-gh-muted">
                      {(session.planContent ?? '').length > 0 ? `${(session.planContent ?? '').length} characters` : 'No body captured yet'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gh-text">
                    {(session.planContent ?? '').length > 0
                      ? truncateMobileText(session.planContent ?? '', 180)
                      : 'The plan header is present, but the detailed body has not been captured yet.'}
                  </p>
                </div>
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="currentColor"
                  className="mt-1 shrink-0 text-gh-muted transition-transform group-open:rotate-90"
                >
                  <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                </svg>
              </div>
            </summary>

            <div className="border-t border-gh-border/60 px-4 py-4">
              {session.isPlanPending ? (
                <div className="mb-4 rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-3 text-sm text-gh-attention">
                  Review this plan and approve or reject it in your terminal to let the session continue.
                </div>
              ) : null}

              {session.planContent ? (
                <MarkdownRenderer content={session.planContent} variant="mobile" collapsible />
              ) : (
                <p className="text-sm leading-relaxed text-gh-muted">
                  Plan content has not been captured yet. The desktop view may still have more context.
                </p>
              )}
            </div>
          </details>
        ) : (
          <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
            No plan content has been captured for this session yet.
          </div>
        )}
      </MobileSectionCard>

      <MobileSectionCard
        title="Todos"
        subtitle={todos.length > 0 ? `${pluralize(todos.length, 'todo')} grouped by status.` : 'No todo items are attached to this session.'}
      >
        {todos.length === 0 ? (
          <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
            No todo items are attached to this session yet.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {todoGroups.map((group) => (
                <span
                  key={group.label}
                  className={`rounded-full border border-gh-border bg-gh-bg px-2.5 py-1 text-[11px] font-medium ${group.accent}`}
                >
                  {group.label} · {group.items.length}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {todoGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${group.accent}`}>{group.label}</p>
                    <span className="text-[11px] text-gh-muted">{group.items.length}</span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((todo) => (
                      <TodoCard key={todo.id} todo={todo} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </MobileSectionCard>
    </div>
  );
}

function AgentsPanel({
  session,
  onOpenThread,
}: {
  session: SessionDetail;
  onOpenThread: (streamId: string) => void;
}) {
  const orderedAgents = useMemo(
    () =>
      [...session.activeSubAgents]
        .reverse()
        .sort((left, right) => Number(left.isCompleted) - Number(right.isCompleted)),
    [session.activeSubAgents],
  );
  const runningCount = orderedAgents.filter((agent) => !agent.isCompleted).length;
  const threadsWithMessages = orderedAgents.filter(
    (agent) => (session.subAgentMessages[agent.toolCallId] ?? []).length > 0,
  ).length;

  return (
    <MobileSectionCard
      title="Sub-agent visibility"
      subtitle={
        orderedAgents.length > 0
          ? 'Inspect running helpers, recent completions, and jump straight into a thread when needed.'
          : 'No sub-agent activity has been recorded for this session.'
      }
    >
      {orderedAgents.length === 0 ? (
        <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
          No sub-agent threads have been captured for this session yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <MobileInfoCard
              label="Running"
              value={runningCount}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="Completed"
              value={orderedAgents.length - runningCount}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
            <MobileInfoCard
              label="With messages"
              value={threadsWithMessages}
              valueClassName="text-sm font-semibold text-gh-text"
              variant="subtle"
            />
          </div>

          <div className="mt-4 space-y-3">
            {orderedAgents.map((agent) => (
              <MobileSubAgentCard
                key={agent.toolCallId}
                agent={agent}
                messages={session.subAgentMessages[agent.toolCallId] ?? []}
                onOpenThread={() => onOpenThread(agent.toolCallId)}
              />
            ))}
          </div>
        </>
      )}
    </MobileSectionCard>
  );
}

// ============================================================================
// Artifact Panel (shared component for checkpoints, research, files)
// ============================================================================

interface ArtifactPanelProps {
  group: SessionArtifactGroup | null;
  sessionId: string;
  title: string;
  emptyMessage: string;
}

function ArtifactPanel({ group, sessionId, title, emptyMessage }: ArtifactPanelProps) {
  const files = useMemo(() => (group?.entries ? collectArtifactFiles(group.entries) : []), [group?.entries]);
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? '');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.path === selectedPath)) {
      setSelectedPath(files[0].path);
    }
  }, [files, selectedPath]);

  const selectedFile = files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (!group || group.status === 'missing') {
    return (
      <MobileSectionCard title={title} subtitle={emptyMessage}>
        <div className="rounded-xl border border-dashed border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
          {group?.message ?? `No ${title.toLowerCase()} content has been captured for this session.`}
        </div>
      </MobileSectionCard>
    );
  }

  if (group.status === 'unreadable') {
    return (
      <MobileSectionCard title={title} subtitle="Unable to read content">
        <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {group.message ?? 'The content could not be read.'}
        </div>
      </MobileSectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <MobileSectionCard
        title={title}
        subtitle={files.length > 0 ? `${pluralize(files.length, 'file')} available.` : 'No files recorded.'}
      >
        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
            No files found in this artifact group.
          </div>
        ) : (
          <div className="space-y-3">
            {/* File selector dropdown for mobile */}
            <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-2">
              <select
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                className="w-full rounded-lg border border-gh-border bg-gh-surface px-3 py-2.5 text-sm text-gh-text focus:border-gh-accent focus:outline-none"
              >
                {files.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.name} ({formatBytes(file.sizeBytes)})
                  </option>
                ))}
              </select>
            </div>

            {/* File tree (collapsible) */}
            {group.entries && group.entries.length > 0 && (
              <details className="group rounded-xl border border-gh-border bg-gh-bg/50">
                <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-gh-text">
                  <span>Browse files</span>
                  <svg
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    fill="currentColor"
                    className="text-gh-muted transition-transform group-open:rotate-90"
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                  </svg>
                </summary>
                <div className="border-t border-gh-border/50 p-2">
                  <FileTree
                    entries={group.entries}
                    selectedPath={selectedPath}
                    onSelectFile={setSelectedPath}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </MobileSectionCard>

      {/* Selected file content */}
      {selectedFile && (
        <MobileSectionCard
          title={selectedFile.name}
          subtitle={`${formatBytes(selectedFile.sizeBytes)} · ${selectedFile.path}`}
        >
          <div className="overflow-hidden rounded-xl border border-gh-border bg-gh-bg/50">
            <ArtifactViewer
              entry={selectedFile}
              sessionId={sessionId}
              isMobile={true}
              collapsible={true}
            />
          </div>
        </MobileSectionCard>
      )}
    </div>
  );
}

// ============================================================================
// Individual Artifact Panels
// ============================================================================

function useSessionArtifacts(sessionId: string) {
  const [artifacts, setArtifacts] = useState<SessionArtifacts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setArtifacts(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSessionArtifacts(sessionId)
      .then((data) => {
        if (cancelled) return;
        setArtifacts(data);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setArtifacts(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load artifacts');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { artifacts, loading, error };
}

function getArtifactGroupByPath(artifacts: SessionArtifacts | null, path: 'checkpoints' | 'research' | 'files'): SessionArtifactGroup | null {
  if (!artifacts) return null;
  return artifacts.folders.find((group) => group.path === path) ?? null;
}

function CheckpointsPanel({ sessionId }: { sessionId: string }) {
  const { artifacts, loading, error } = useSessionArtifacts(sessionId);
  const group = getArtifactGroupByPath(artifacts, 'checkpoints');

  if (loading) {
    return (
      <MobileSectionCard title="Checkpoints" subtitle="Loading checkpoint data...">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </MobileSectionCard>
    );
  }

  if (error) {
    return (
      <MobileSectionCard title="Checkpoints" subtitle="Failed to load">
        <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      </MobileSectionCard>
    );
  }

  return (
    <ArtifactPanel
      group={group}
      sessionId={sessionId}
      title="Checkpoints"
      emptyMessage="Captured checkpoints from context compaction."
    />
  );
}

function ResearchPanel({ sessionId }: { sessionId: string }) {
  const { artifacts, loading, error } = useSessionArtifacts(sessionId);
  const group = getArtifactGroupByPath(artifacts, 'research');

  if (loading) {
    return (
      <MobileSectionCard title="Research" subtitle="Loading research data...">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </MobileSectionCard>
    );
  }

  if (error) {
    return (
      <MobileSectionCard title="Research" subtitle="Failed to load">
        <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      </MobileSectionCard>
    );
  }

  return (
    <ArtifactPanel
      group={group}
      sessionId={sessionId}
      title="Research"
      emptyMessage="Research notes, references, and supporting files."
    />
  );
}

function FilesPanel({ sessionId }: { sessionId: string }) {
  const { artifacts, loading, error } = useSessionArtifacts(sessionId);
  const group = getArtifactGroupByPath(artifacts, 'files');

  if (loading) {
    return (
      <MobileSectionCard title="Files" subtitle="Loading file data...">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </MobileSectionCard>
    );
  }

  if (error) {
    return (
      <MobileSectionCard title="Files" subtitle="Failed to load">
        <div className="rounded-xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
          {error}
        </div>
      </MobileSectionCard>
    );
  }

  return (
    <ArtifactPanel
      group={group}
      sessionId={sessionId}
      title="Files"
      emptyMessage="Additional files and documents from the session."
    />
  );
}

interface StickySummaryBarProps {
  session: SessionDetail;
  activeSection: DetailSectionId;
  onSectionChange: (section: DetailSectionId) => void;
  showBackLinks?: boolean;
  artifactCounts?: {
    checkpoints: number;
    research: number;
    files: number;
  };
}

function StickySummaryBar({ session, activeSection, onSectionChange, showBackLinks, artifactCounts }: StickySummaryBarProps) {
  const state = getMobileSessionState(session);
  const projectName = getProjectName(session.projectPath);
  const todos = session.todos ?? [];
  const activeAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
  const completedAgents = session.activeSubAgents.length - activeAgents;
  const blockedTodos = todos.filter((t) => t.status === 'blocked').length;
  const inProgressTodos = todos.filter((t) => t.status === 'in_progress').length;
  const doneTodos = todos.filter((t) => t.status === 'done' || t.status === 'completed').length;

  const workSurfaceCount = (session.isPlanPending || session.planContent ? 1 : 0) + todos.length;
  const checkpointsCount = artifactCounts?.checkpoints ?? 0;
  const researchCount = artifactCounts?.research ?? 0;
  const filesCount = artifactCounts?.files ?? 0;

  const getStateAccentColor = () => {
    if (session.needsAttention) return 'bg-gh-attention';
    if (session.lastError) return 'bg-gh-warning';
    if (session.isWorking) return 'bg-gh-active';
    if (session.isTaskComplete) return 'bg-emerald-400';
    if (session.isAborted) return 'bg-red-400';
    return 'bg-gh-accent';
  };

  const getStateBgColor = () => {
    if (session.needsAttention) return 'bg-gh-attention/10 border-gh-attention/30';
    if (session.lastError) return 'bg-gh-warning/10 border-gh-warning/30';
    if (session.isWorking) return 'bg-gh-active/10 border-gh-active/30';
    if (session.isTaskComplete) return 'bg-emerald-400/10 border-emerald-400/30';
    if (session.isAborted) return 'bg-red-400/10 border-red-400/30';
    return 'bg-gh-surface border-gh-border';
  };

  // Format duration compactly
  const formatCompactDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="relative sticky top-0 z-20 -mx-3 border-b border-gh-border bg-gh-surface px-3 py-3">
      {/* Primary row: Status + Title + Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Compact status line with live indicator */}
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${getStateAccentColor()} ${session.isWorking ? 'animate-pulse' : ''}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${state.className.split(' ').pop()}`}>
              {state.label}
            </span>
            {session.isOpen && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gh-muted">
                <span className="h-1 w-1 rounded-full bg-gh-active animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Session title */}
          <h2 className="mt-1.5 text-base font-semibold leading-tight text-gh-text line-clamp-1">
            {session.title}
          </h2>

          {/* Context line with more info */}
          <p className="mt-0.5 text-xs text-gh-muted line-clamp-1">
            {projectName}
            {session.gitBranch ? <span> · <span className="text-gh-accent">{session.gitBranch}</span></span> : null}
            {session.model ? <span> · <span className="text-gh-muted">{session.model}</span></span> : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {showBackLinks && (
            <Link
              to="/m"
              className="rounded-lg border border-gh-border bg-gh-bg px-2.5 py-1.5 text-[11px] font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
            >
              Back
            </Link>
          )}
        </div>
      </div>

      {/* Essential signals row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Messages count */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-bg px-2 py-1">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="text-gh-muted">
            <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75Zm0 5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          <span className="text-[11px] font-medium text-gh-text">{session.messages.length}</span>
        </div>

        {/* Duration */}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-gh-border bg-gh-bg px-2 py-1">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="text-gh-muted">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8v-3.25a.75.75 0 0 1 1.5 0Z"/>
          </svg>
          <span className="text-[11px] font-medium text-gh-text">{formatCompactDuration(session.durationMs)}</span>
        </div>

        {/* State badges */}
        {session.isPlanPending && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gh-attention/30 bg-gh-attention/10 px-2 py-1 text-[11px] font-medium text-gh-attention">
            <span className="h-1.5 w-1.5 rounded-full bg-gh-attention" />
            Plan
          </span>
        )}

        {activeAgents > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gh-active/30 bg-gh-active/10 px-2 py-1 text-[11px] font-medium text-gh-active">
            <span className="h-1.5 w-1.5 rounded-full bg-gh-active animate-pulse" />
            {activeAgents} agent{activeAgents > 1 ? 's' : ''}
          </span>
        )}

        {inProgressTodos > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gh-accent/30 bg-gh-accent/10 px-2 py-1 text-[11px] font-medium text-gh-accent">
            {inProgressTodos} todo
          </span>
        )}

        {blockedTodos > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gh-attention/30 bg-gh-attention/10 px-2 py-1 text-[11px] font-medium text-gh-attention">
            <span className="h-1.5 w-1.5 rounded-full bg-gh-attention" />
            {blockedTodos} blocked
          </span>
        )}

        {doneTodos > 0 && todos.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-gh-active/30 bg-gh-active/10 px-2 py-1 text-[11px] font-medium text-gh-active">
            {doneTodos}/{todos.length} done
          </span>
        )}
      </div>

      {/* Sticky tab bar */}
      <div className="mt-3 -mx-3 border-t border-gh-border/50 px-3 pt-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { id: 'overview' as const, label: 'Overview' },
            { id: 'activity' as const, label: 'Activity', count: session.messages.length },
            { id: 'work' as const, label: 'Work', count: workSurfaceCount },
            { id: 'agents' as const, label: 'Agents', count: session.activeSubAgents.length },
            { id: 'checkpoints' as const, label: 'Checkpoints', count: checkpointsCount },
            { id: 'research' as const, label: 'Research', count: researchCount },
            { id: 'files' as const, label: 'Files', count: filesCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange(tab.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[44px] ${
                activeSection === tab.id
                  ? 'bg-gh-accent text-white'
                  : 'border border-gh-border bg-gh-bg text-gh-muted hover:bg-gh-surface hover:text-gh-text'
              }`}
            >
              {tab.label}
              {tab.count ? (
                <span className={`ml-1.5 ${activeSection === tab.id ? 'text-white/70' : 'text-gh-muted'}`}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MobileSessionPaneInnerProps {
  session: SessionDetail;
  showBackLinks?: boolean;
  error?: string | null;
}

function MobileSessionPaneInner({ session, showBackLinks = false, error }: MobileSessionPaneInnerProps) {
  const [activeSection, setActiveSection] = useState<DetailSectionId>('overview');
  const [activeStreamId, setActiveStreamId] = useState('main');
  
  // Fetch artifacts for badge counts and panel content
  const { artifacts } = useSessionArtifacts(session.id);
  const artifactCounts = useMemo(() => {
    const checkpointsGroup = getArtifactGroupByPath(artifacts, 'checkpoints');
    const researchGroup = getArtifactGroupByPath(artifacts, 'research');
    const filesGroup = getArtifactGroupByPath(artifacts, 'files');
    
    return {
      checkpoints: checkpointsGroup?.entries ? collectArtifactFiles(checkpointsGroup.entries).length : 0,
      research: researchGroup?.entries ? collectArtifactFiles(researchGroup.entries).length : 0,
      files: filesGroup?.entries ? collectArtifactFiles(filesGroup.entries).length : 0,
    };
  }, [artifacts]);
  
  const streams = useMemo<MessageStream[]>(
    () =>
      session
        ? [
            {
              id: 'main',
              label: 'Main session',
              description: 'Primary conversation between the user and Copilot.',
              messages: [...session.messages].reverse(),
              isSubAgent: false,
            },
            ...[...session.activeSubAgents]
              .reverse()
              .sort((left, right) => Number(left.isCompleted) - Number(right.isCompleted))
              .map((agent) => ({
                id: agent.toolCallId,
                label: getMobileSubAgentLabel(agent),
                description: agent.description || 'Sub-agent thread',
                messages: [...(session.subAgentMessages[agent.toolCallId] ?? [])].reverse(),
                isSubAgent: true,
                isCompleted: agent.isCompleted,
              })),
          ]
        : [],
    [session.activeSubAgents, session.messages, session.subAgentMessages],
  );

  useEffect(() => {
    setActiveSection('overview');
    setActiveStreamId('main');
  }, [session.id]);

  useEffect(() => {
    if (session.isPlanPending && activeSection === 'overview') {
      setActiveSection('work');
    }
  }, [activeSection, session.id, session.isPlanPending]);

  useEffect(() => {
    if (streams.length === 0) {
      return;
    }

    if (!streams.some((stream) => stream.id === activeStreamId)) {
      setActiveStreamId('main');
    }
  }, [activeStreamId, streams]);

  const projectName = getProjectName(session.projectPath);
  const todos = session.todos ?? [];
  const activeAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
  const completedAgents = session.activeSubAgents.length - activeAgents;
  const callout = getSessionCallout(session, todos.length, activeAgents, completedAgents);

  const handleOpenThread = (streamId: string) => {
    setActiveStreamId(streamId);
    setActiveSection('activity');
  };

  return (
    <section className="relative px-3 pb-6">
      {/* Sticky summary bar - uses negative margins to bleed to edges */}
      <StickySummaryBar
        session={session}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        showBackLinks={showBackLinks}
        artifactCounts={artifactCounts}
      />

      {/* Content area */}
      <div className="mt-4 space-y-4">
        {activeSection === 'overview' ? (
          <>
            {/* Header card with session details - only visible in Overview tab */}
            <div className="rounded-2xl border border-gh-border bg-gradient-to-br from-gh-surface to-gh-bg p-4 shadow-sm">
              <div className={`rounded-2xl border p-3 ${callout.toneClass}`}>
                <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">Now</p>
                <p className="mt-2 text-sm font-semibold text-gh-text">{callout.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gh-muted">{callout.description}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {todos.length > 0 ? (
                    <span className="rounded-full border border-gh-border/70 bg-gh-bg/70 px-2.5 py-1 text-[11px] text-gh-text">
                      {pluralize(todos.length, 'todo')}
                    </span>
                  ) : null}
                  {activeAgents > 0 ? (
                    <span className="rounded-full border border-gh-active/30 bg-gh-active/10 px-2.5 py-1 text-[11px] text-gh-active">
                      {pluralize(activeAgents, 'active sub-agent', 'active sub-agents')}
                    </span>
                  ) : null}
                  {completedAgents > 0 ? (
                    <span className="rounded-full border border-gh-border bg-gh-bg px-2.5 py-1 text-[11px] text-gh-muted">
                      {pluralize(completedAgents, 'completed sub-agent', 'completed sub-agents')}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <MobileInfoCard
                  label="Last activity"
                  value={<RelativeTime timestamp={session.lastActivityAt} className="text-sm text-gh-text" />}
                />
                <MobileInfoCard label="Duration" value={formatDuration(session.durationMs)} />
                <MobileInfoCard label="Messages" value={session.messages.length} />
                <MobileInfoCard label="Sub-agents" value={session.activeSubAgents.length} />
              </div>

              {showBackLinks ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/m"
                    className="inline-flex items-center rounded-xl border border-gh-border bg-gh-bg px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
                  >
                    Back to sessions
                  </Link>
                  <Link
                    to={`/sessions/${session.id}`}
                    className="inline-flex items-center rounded-xl border border-gh-border bg-gh-bg px-3 py-2 text-xs font-medium text-gh-text transition-colors hover:border-gh-accent/40 hover:text-gh-accent"
                  >
                    Open desktop detail
                  </Link>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-2xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
                Live updates are temporarily failing: {error}
              </div>
            ) : null}

            <OverviewPanel session={session} projectName={projectName} todos={todos} onNavigate={setActiveSection} />
          </>
        ) : null}
        {activeSection === 'activity' ? (
          <ActivityPanel
            session={session}
            streams={streams}
            activeStreamId={activeStreamId}
            onStreamChange={setActiveStreamId}
          />
        ) : null}
        {activeSection === 'work' ? <WorkPanel session={session} todos={todos} /> : null}
        {activeSection === 'agents' ? <AgentsPanel session={session} onOpenThread={handleOpenThread} /> : null}
        {activeSection === 'checkpoints' ? <CheckpointsPanel sessionId={session.id} /> : null}
        {activeSection === 'research' ? <ResearchPanel sessionId={session.id} /> : null}
        {activeSection === 'files' ? <FilesPanel sessionId={session.id} /> : null}
      </div>
    </section>
  );
}

export { MobileSessionPaneInner };

export interface MobileSessionPaneProps {
  sessionId: string;
  showBackLinks?: boolean;
}

export function MobileSessionPane({ sessionId, showBackLinks = false }: MobileSessionPaneProps) {
  const { session, loading, error } = useSession(sessionId);

  if (loading && !session) {
    return <LoadingSpinner />;
  }

  if (error && !session) {
    return (
      <div className="rounded-2xl border border-gh-attention/30 bg-gh-attention/10 p-4 text-sm text-gh-attention">
        {error}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-2xl border border-gh-border bg-gh-surface p-6 text-center">
        <p className="text-sm text-gh-text">Session not found.</p>
        <Link to="/" className="mt-3 inline-flex text-sm font-medium text-gh-accent hover:text-gh-text">
          Back to sessions
        </Link>
      </div>
    );
  }

  return <MobileSessionPaneInner session={session} showBackLinks={showBackLinks} error={error} />;
}
