import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ActiveSubAgent, ParsedMessage, SessionDetail, TodoItem, ToolRequest } from '../../api/client.ts';
import { useSession } from '../../hooks/useSession.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { RelativeTime, formatDuration } from '../shared/RelativeTime.tsx';
import { ModeBadge } from '../shared/modeBadge.tsx';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { MobileInfoCard } from './MobileInfoCard.tsx';
import { getMobileSessionState } from './mobileSessionState.ts';
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

const MOBILE_VISIBLE_MESSAGES = 10;

type DetailSectionId = 'overview' | 'activity' | 'work' | 'agents';

interface DetailTab {
  id: DetailSectionId;
  label: string;
  badge?: string;
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

function MobileTabBar({
  tabs,
  activeId,
  onChange,
}: {
  tabs: DetailTab[];
  activeId: DetailSectionId;
  onChange: (id: DetailSectionId) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex w-max min-w-full gap-2 rounded-2xl border border-gh-border bg-gh-surface/80 p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`min-w-[84px] rounded-xl px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-gh-bg text-gh-text shadow-sm'
                  : 'text-gh-muted hover:bg-gh-bg/70 hover:text-gh-text'
              }`}
            >
              <span className="block text-xs font-semibold">{tab.label}</span>
              {tab.badge ? <span className="mt-1 block text-[11px] text-gh-muted">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolStatusPill({ tool }: { tool: ToolRequest }) {
  const toneClass = tool.error
    ? 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention'
    : tool.result
      ? 'border-gh-active/30 bg-gh-active/10 text-gh-active'
      : 'border-gh-border bg-gh-bg text-gh-muted';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${toneClass}`}>
      <span>{tool.toolTitle || tool.name}</span>
      <span className="text-[10px] opacity-80">{tool.error ? 'Error' : tool.result ? 'Done' : 'Pending'}</span>
    </span>
  );
}

function MobileMessageCard({ message }: { message: ParsedMessage }) {
  const snippet = truncateMobileText(getMessageSnippet(message), MOBILE_MESSAGE_SNIPPET_MAX_LENGTH);
  const toolNames = message.toolRequests?.map((tool) => tool.toolTitle || tool.name) ?? [];
  const hasDetails =
    message.content.trim().length > snippet.length ||
    Boolean(message.reasoning?.trim()) ||
    (message.toolRequests?.length ?? 0) > 0;

  return (
    <article className="rounded-2xl border border-gh-border bg-gh-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${MESSAGE_ROLE_TONES[message.role]}`}
          >
            {titleCaseMobileLabel(message.role)}
          </span>
          {message.toolRequests?.length ? (
            <span className="text-[11px] text-gh-muted">{pluralize(message.toolRequests.length, 'tool call')}</span>
          ) : null}
        </div>
        <RelativeTime timestamp={message.timestamp} className="shrink-0 text-xs text-gh-muted" />
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gh-text">{snippet}</p>

      {toolNames.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {toolNames.slice(0, 3).map((toolName, index) => (
            <span
              key={`${message.id}-${toolName}-${index}`}
              className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted"
            >
              {toolName}
            </span>
          ))}
          {toolNames.length > 3 ? (
            <span className="rounded-full border border-gh-border bg-gh-bg px-2 py-1 text-[11px] text-gh-muted">
              +{toolNames.length - 3} more
            </span>
          ) : null}
        </div>
      ) : null}

      {hasDetails ? (
        <details className="mt-3 group">
          <summary className="flex list-none cursor-pointer items-center justify-between gap-3 text-xs font-medium text-gh-accent">
            <span>Expand message</span>
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="currentColor"
              className="shrink-0 text-gh-muted transition-transform group-open:rotate-90"
            >
              <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </summary>
          <div className="mt-3 space-y-3 border-t border-gh-border/60 pt-3">
            {message.content.trim() ? (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gh-muted">Content</p>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gh-text">
                  {message.content.trim()}
                </pre>
              </div>
            ) : null}

            {message.reasoning?.trim() ? (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gh-muted">Reasoning</p>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gh-muted">
                  {message.reasoning.trim()}
                </pre>
              </div>
            ) : null}

            {message.toolRequests?.length ? (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gh-muted">Tool activity</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {message.toolRequests.map((tool) => (
                    <ToolStatusPill key={tool.toolCallId} tool={tool} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
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
  const activeStream = streams.find((stream) => stream.id === activeStreamId) ?? streams[0];
  const totalToolCalls = activeStream.messages.reduce((total, message) => total + (message.toolRequests?.length ?? 0), 0);
  const visibleMessages = showAllMessages
    ? activeStream.messages
    : activeStream.messages.slice(0, MOBILE_VISIBLE_MESSAGES);
  const hiddenCount = Math.max(0, activeStream.messages.length - visibleMessages.length);

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
              value={activeStream.messages.length}
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
                activeStream.messages.length > 0 ? (
                  <RelativeTime timestamp={activeStream.messages[0].timestamp} className="text-sm text-gh-text" />
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

      <MobileSectionCard
        title="Messages"
        subtitle={
          activeStream.messages.length > 0
            ? `${pluralize(activeStream.messages.length, 'message')} in this stream.`
            : 'No messages have been captured in this stream yet.'
        }
      >
        {activeStream.messages.length === 0 ? (
          <div className="rounded-xl border border-gh-border bg-gh-bg/70 p-4 text-sm text-gh-muted">
            No messages have been captured for this stream yet.
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
                <MarkdownRenderer content={session.planContent} variant="mobile" />
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

interface MobileSessionPaneInnerProps {
  session: SessionDetail;
  showBackLinks?: boolean;
  error?: string | null;
}

function MobileSessionPaneInner({ session, showBackLinks = false, error }: MobileSessionPaneInnerProps) {
  const [activeSection, setActiveSection] = useState<DetailSectionId>('overview');
  const [activeStreamId, setActiveStreamId] = useState('main');
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

  const state = getMobileSessionState(session);
  const projectName = getProjectName(session.projectPath);
  const todos = session.todos ?? [];
  const activeAgents = session.activeSubAgents.filter((agent) => !agent.isCompleted).length;
  const completedAgents = session.activeSubAgents.length - activeAgents;
  const callout = getSessionCallout(session, todos.length, activeAgents, completedAgents);
  const detailMetrics = [
    { label: 'Last activity', value: <RelativeTime timestamp={session.lastActivityAt} className="text-sm text-gh-text" /> },
    { label: 'Duration', value: formatDuration(session.durationMs) },
    { label: 'Messages', value: session.messages.length },
    { label: 'Sub-agents', value: session.activeSubAgents.length },
  ];
  const workSurfaceCount = (session.isPlanPending || session.planContent ? 1 : 0) + todos.length;
  const tabs: DetailTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity', badge: pluralize(session.messages.length, 'message') },
    { id: 'work', label: 'Work', badge: workSurfaceCount > 0 ? `${workSurfaceCount} items` : undefined },
    { id: 'agents', label: 'Agents', badge: session.activeSubAgents.length > 0 ? `${session.activeSubAgents.length} threads` : undefined },
  ];

  const handleOpenThread = (streamId: string) => {
    setActiveStreamId(streamId);
    setActiveSection('activity');
  };

  return (
    <section className="space-y-4 pb-6">
      <div className="rounded-2xl border border-gh-border bg-gradient-to-br from-gh-surface to-gh-bg p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${state.className}`}>
                {state.label}
              </span>
              <ModeBadge mode={session.currentMode} />
              {session.isPlanPending ? (
                <span className="inline-flex rounded-full border border-gh-attention/30 bg-gh-attention/10 px-2.5 py-1 text-[11px] font-medium text-gh-attention">
                  Plan review
                </span>
              ) : null}
            </div>

            <h2 className="mt-3 text-lg font-semibold leading-snug text-gh-text">{session.title}</h2>
            <p className="mt-2 text-sm text-gh-muted">
              {projectName}
              {session.gitBranch ? <span> · {session.gitBranch}</span> : null}
            </p>
          </div>

          <RelativeTime timestamp={session.lastActivityAt} className="shrink-0 text-xs text-gh-muted" />
        </div>

        <div className={`mt-4 rounded-2xl border p-3 ${callout.toneClass}`}>
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
          {detailMetrics.map((metric) => (
            <MobileInfoCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
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

      <MobileTabBar tabs={tabs} activeId={activeSection} onChange={setActiveSection} />

      {activeSection === 'overview' ? (
        <OverviewPanel session={session} projectName={projectName} todos={todos} onNavigate={setActiveSection} />
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
