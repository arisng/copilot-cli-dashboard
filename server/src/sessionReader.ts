import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import type {
  RawEvent,
  SessionStartData,
  UserMessageData,
  AssistantMessageData,
  ToolExecutionCompleteData,
  ShutdownData,
  ParsedMessage,
  SessionSummary,
  SessionDetail,
  ActiveSubAgent,
  TodoItem,
} from './sessionTypes.js';
import { needsAttention, lastSessionStatus, hasPendingWork, hasPendingPlanApproval } from './utils/needsAttention.js';

const SESSIONS_BASE = path.join(os.homedir(), '.copilot', 'session-state');

function parseEventsFile(filePath: string): RawEvent[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RawEvent);
  } catch {
    return [];
  }
}

function extractTitle(messages: ParsedMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'Untitled session';
  const text = firstUser.content.replace(/<[^>]+>/g, '').trim(); // strip XML tags from transformedContent
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}

function buildMessagesFromEvents(events: RawEvent[], parentToolCallId?: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Pre-build a map of toolCallId → execution result/error scoped to this thread
  const toolResults = new Map<string, ToolExecutionCompleteData>();
  for (const event of events) {
    if (event.type === 'tool.execution_complete') {
      const d = event.data as unknown as ToolExecutionCompleteData & { parentToolCallId?: string };
      if ((d.parentToolCallId ?? undefined) === parentToolCallId) {
        toolResults.set(d.toolCallId, d);
      }
    }
  }

  for (const event of events) {
    const dataParent = (event.data as Record<string, unknown>).parentToolCallId as string | undefined;
    // Only include events that belong to this thread
    if ((dataParent ?? undefined) !== parentToolCallId) continue;

    if (event.type === 'user.message') {
      const data = event.data as unknown as UserMessageData;
      messages.push({
        id: event.id,
        role: 'user',
        content: data.content,
        timestamp: event.timestamp,
        interactionId: data.interactionId,
      });
    } else if (event.type === 'assistant.message') {
      const data = event.data as unknown as AssistantMessageData;
      const toolRequests = data.toolRequests?.map((tr) => {
        const exec = toolResults.get(tr.toolCallId);
        return exec
          ? { ...tr, result: exec.result, error: exec.error }
          : tr;
      });
      messages.push({
        id: event.id,
        role: 'assistant',
        content: data.content,
        toolRequests,
        timestamp: event.timestamp,
        interactionId: data.interactionId,
      });
    } else if (event.type === 'session.task_complete') {
      // Only include task_complete in the root thread
      if (parentToolCallId === undefined) {
        const data = event.data as unknown as { summary: string };
        messages.push({
          id: event.id,
          role: 'task_complete',
          content: data.summary,
          timestamp: event.timestamp,
        });
      }
    }
  }

  return messages;
}

function buildMessages(events: RawEvent[]): ParsedMessage[] {
  return buildMessagesFromEvents(events, undefined);
}

function buildSubAgentMessages(events: RawEvent[], agents: ActiveSubAgent[]): Record<string, ParsedMessage[]> {
  const result: Record<string, ParsedMessage[]> = {};

  // Build a lookup of read_agent completions for synthesizing messages
  const readAgentResults = new Map<string, { content: string; id: string; timestamp: string }>();
  for (const event of events) {
    if (event.type === 'tool.execution_complete') {
      const d = event.data as Record<string, unknown>;
      if (!d.parentToolCallId && d.toolCallId) {
        const res = d.result as { content?: string } | undefined;
        readAgentResults.set(d.toolCallId as string, {
          content: res?.content ?? '',
          id: event.id,
          timestamp: event.timestamp,
        });
      }
    }
  }

  for (const agent of agents) {
    if (agent.agentName === 'read_agent') {
      // read_agent sub-agents have no parentToolCallId events — synthesize from tool result
      const res = readAgentResults.get(agent.toolCallId);
      result[agent.toolCallId] = res
        ? [{ id: res.id, role: 'assistant', content: res.content, timestamp: res.timestamp }]
        : [];
    } else {
      // task-based sub-agents: filter events by parentToolCallId
      result[agent.toolCallId] = buildMessagesFromEvents(events, agent.toolCallId);
    }
  }
  return result;
}

function buildActiveSubAgents(events: RawEvent[]): ActiveSubAgent[] {
  // Collect sub-agent lifecycle events from the current interaction only
  // (reset on each user.message so stale sub-agents don't linger)
  const started = new Map<string, { agentName: string; agentDisplayName: string; sessionId?: string }>();
  const completed = new Set<string>();
  // Map toolCallId → description from task/read_agent calls
  const descriptions = new Map<string, string>();

  let currentStarted = new Map<string, { agentName: string; agentDisplayName: string; sessionId?: string }>();
  let currentCompleted = new Set<string>();
  let currentDescriptions = new Map<string, string>();
  // track read_agent toolCallIds so we can detect their completion via tool.execution_complete
  let currentReadAgentIds = new Set<string>();

  for (const event of events) {
    const isSubEvent = !!(event.data as Record<string, unknown>).parentToolCallId;

    if (event.type === 'user.message' && !isSubEvent) {
      // Reset per interaction (root messages only)
      currentStarted = new Map();
      currentCompleted = new Set();
      currentDescriptions = new Map();
      currentReadAgentIds = new Set();
    } else if (event.type === 'assistant.message' && !isSubEvent) {
      const data = event.data as unknown as AssistantMessageData;
      for (const tr of data.toolRequests ?? []) {
        if (tr.name === 'task' || tr.name === 'task_complete') {
          const args = tr.arguments as { description?: string };
          if (args.description) currentDescriptions.set(tr.toolCallId, args.description);
        }
      }
    } else if (event.type === 'subagent.started') {
      const d = event.data as { toolCallId: string; agentName: string; agentDisplayName: string; sessionId?: string };
      currentStarted.set(d.toolCallId, { agentName: d.agentName, agentDisplayName: d.agentDisplayName, sessionId: d.sessionId });
    } else if (event.type === 'subagent.completed' || event.type === 'subagent.failed') {
      const d = event.data as { toolCallId: string };
      currentCompleted.add(d.toolCallId);
    } else if (event.type === 'tool.execution_start' && !isSubEvent) {
      // read_agent calls spawn async agents without subagent.started events
      const d = event.data as { toolCallId: string; toolName: string; arguments: Record<string, unknown> };
      if (d.toolName === 'read_agent') {
        const agentId = d.arguments?.agent_id as string | undefined;
        currentReadAgentIds.add(d.toolCallId);
        currentStarted.set(d.toolCallId, {
          agentName: 'read_agent',
          agentDisplayName: agentId ?? 'Read Agent',
        });
        if (agentId) currentDescriptions.set(d.toolCallId, agentId);
      }
    } else if (event.type === 'tool.execution_complete' && !isSubEvent) {
      const d = event.data as { toolCallId: string };
      if (currentReadAgentIds.has(d.toolCallId)) {
        currentCompleted.add(d.toolCallId);
      }
    }
  }

  // Copy final state
  for (const [id, v] of currentStarted) started.set(id, v);
  for (const id of currentCompleted) completed.add(id);
  for (const [id, v] of currentDescriptions) descriptions.set(id, v);

  return [...started.entries()].map(([toolCallId, { agentName, agentDisplayName, sessionId }]) => ({
    toolCallId,
    agentName,
    agentDisplayName,
    description: descriptions.get(toolCallId),
    isCompleted: completed.has(toolCallId),
    sessionId,
  }));
}

function readTodos(sessionDir: string): TodoItem[] | undefined {
  const dbPath = path.join(sessionDir, 'session.db');
  if (!fs.existsSync(dbPath)) return undefined;
  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT * FROM todos ORDER BY created_at ASC').all() as Array<{
      id: string; title: string; description: string; status: string;
      created_at: string; updated_at: string;
    }>;
    const deps = db.prepare('SELECT * FROM todo_deps').all() as Array<{ todo_id: string; depends_on: string }>;
    db.close();

    const depsMap: Record<string, string[]> = {};
    for (const d of deps) {
      (depsMap[d.todo_id] ??= []).push(d.depends_on);
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      dependsOn: depsMap[r.id] ?? [],
    }));
  } catch {
    return undefined;
  }
}

export function parseSessionDir(sessionId: string): SessionDetail | null {
  const sessionDir = path.join(SESSIONS_BASE, sessionId);
  const eventsFile = path.join(sessionDir, 'events.jsonl');

  const hasLockFile = fs
    .readdirSync(sessionDir)
    .some((f) => f.startsWith('inuse.') && f.endsWith('.lock'));
  // Lock file is the source of truth: present = process is running, even if a
  // prior run wrote a session.shutdown (e.g. a resumed session).
  const isOpen = hasLockFile;

  const events = fs.existsSync(eventsFile) ? parseEventsFile(eventsFile) : [];

  const startEvent = events.find((e) => e.type === 'session.start');
  const shutdownEvent = events.find((e) => e.type === 'session.shutdown');

  // Brand-new session: lock file exists but events not yet written — show as
  // a placeholder so it appears immediately in the list.
  if (events.length === 0 || !startEvent) {
    if (!isOpen) return null;
    const now = new Date().toISOString();
    const stub: SessionDetail = {
      id: sessionId,
      title: 'New',
      projectPath: 'Unknown',
      gitBranch: null,
      startedAt: now,
      lastActivityAt: now,
      durationMs: 0,
      isOpen: true,
      needsAttention: false,
      isWorking: false,
      isAborted: false,
      isTaskComplete: false,
      isIdle: true,
      messageCount: 0,
      activeSubAgents: [],
      hasPlan: false,
      isPlanPending: false,
      messages: [],
      subAgentMessages: {},
    };
    return stub;
  }

  const startData = startEvent.data as unknown as SessionStartData;
  const startedAt = startData.startTime ?? startEvent.timestamp;

  const messages = buildMessages(events);
  const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;

  const shutdownData = shutdownEvent?.data as unknown as ShutdownData | undefined;
  // Prefer the last model_change event (covers active sessions); fall back to shutdown metadata
  const lastModelChange = [...events].reverse().find((e) => e.type === 'session.model_change');
  const model =
    (lastModelChange?.data as unknown as { newModel?: string } | undefined)?.newModel ??
    shutdownData?.currentModel;

  const activeSubAgents = buildActiveSubAgents(events);
  const subAgentMessages = buildSubAgentMessages(events, activeSubAgents);

  const planFile = path.join(sessionDir, 'plan.md');
  const hasPlan = fs.existsSync(planFile);
  const isPlanPending = isOpen && hasPendingPlanApproval(events);
  const planContent = hasPlan ? fs.readFileSync(planFile, 'utf8') : undefined;

  const summary: SessionSummary = {
    id: sessionId,
    title: extractTitle(messages),
    projectPath: startData.context?.cwd ?? 'Unknown',
    gitBranch: startData.context?.branch ?? null,
    startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(startedAt),
    isOpen,
    needsAttention: needsAttention(events, isOpen),
    isWorking: isOpen && (lastSessionStatus(events) === 'working' || hasPendingWork(events)),
    isAborted: isOpen && lastSessionStatus(events) === 'aborted',
    isTaskComplete: isOpen && lastSessionStatus(events) === 'task_complete',
    isIdle: isOpen && lastSessionStatus(events) === 'idle',
    messageCount: messages.filter((m) => m.role === 'user').length,
    model,
    activeSubAgents,
    hasPlan,
    isPlanPending,
  };

  const todos = readTodos(sessionDir);

  return { ...summary, messages, subAgentMessages, planContent, todos };
}

export function listAllSessions(): SessionSummary[] {
  if (!fs.existsSync(SESSIONS_BASE)) {
    return [];
  }

  const entries = fs.readdirSync(SESSIONS_BASE, { withFileTypes: true });
  const sessions: SessionSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const detail = parseSessionDir(entry.name);
    if (detail) {
      const { messages: _msgs, ...summary } = detail;
      sessions.push(summary);
    }
  }

  // Sort by last activity, newest first
  return sessions.sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
  );
}
