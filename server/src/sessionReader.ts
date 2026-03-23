import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import type {
  RawEvent,
  SessionStartData,
  UserMessageData,
  AssistantMessageData,
  ToolExecutionCompleteData,
  ShutdownData,
  ParsedMessage,
  MessagePreview,
  SessionSummary,
  SessionDetail,
  ActiveSubAgent,
  TodoItem,
  SessionUsageMetricSource,
} from './sessionTypes.js';
import { needsAttention, lastSessionStatus, hasPendingWork, hasPendingPlanApproval, getCurrentMode } from './utils/needsAttention.js';

const DEFAULT_SESSION_ROOT = path.join(os.homedir(), '.copilot', 'session-state');
const ROOT_DISCOVERY_TTL_MS = 30_000;

type SessionRootsCache = {
  configuredRootsKey: string | null;
  roots: string[];
  discoveredAt: number;
};

type SessionSummaryScan = {
  reducerEvents: RawEvent[];
  eventCount: number;
  startData?: SessionStartData;
  startedAt?: string;
  shutdownData?: ShutdownData;
  lastShutdownAt?: string;
  lastModelChange?: string;
  lastActivityAt?: string;
  firstUserContent?: string;
  messageCount: number;
  previewMessages: MessagePreview[];
};

type CachedSessionSummary = {
  signature: string;
  summary: SessionSummary | null;
};

type SessionUsageMetrics = {
  totalApiDurationMs: number | null;
  totalApiDurationEstimateMs: number;
  totalApiDurationSource: SessionUsageMetricSource;
  totalPremiumRequests: number | null;
  totalPremiumRequestsEstimate: number;
  totalPremiumRequestsSource: SessionUsageMetricSource;
};

let sessionRootsCache: SessionRootsCache | null = null;
const sessionSummaryCache = new Map<string, CachedSessionSummary>();

function normalizeRoot(root: string): string {
  return root.trim().replace(/[\\/]+$/, '');
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function listDirectories(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function parseConfiguredRoots(): string[] {
  const configured = process.env.COPILOT_SESSION_STATE;
  if (!configured) return [];

  return configured
    .split(path.delimiter)
    .map(normalizeRoot)
    .filter((root) => root.length > 0);
}

function discoverWslSessionRoots(): string[] {
  if (process.platform !== 'win32') return [];

  const roots = new Set<string>();

  const registry = spawnSync('reg.exe', [
    'query',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss',
    '/s',
    '/v',
    'DistributionName',
  ], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1500,
  });

  if (registry.status !== 0 || !registry.stdout) return [];

  const distros = new Set<string>();
  for (const line of registry.stdout.split(/\r?\n/)) {
    const match = line.match(/DistributionName\s+REG_\w+\s+(.+)$/i);
    if (match) {
      const distro = match[1].trim();
      if (distro) distros.add(distro);
    }
  }

  for (const distro of distros) {
    const distroRoot = `\\\\wsl$\\${distro}`;

    const homeRoot = path.join(distroRoot, 'home');
    for (const user of listDirectories(homeRoot)) {
      const root = path.join(homeRoot, user, '.copilot', 'session-state');
      if (isDirectory(root)) {
        roots.add(root);
      }
    }

    const rootHome = path.join(distroRoot, 'root', '.copilot', 'session-state');
    if (isDirectory(rootHome)) {
      roots.add(rootHome);
    }
  }

  return [...roots];
}

function discoverSessionRoots(): string[] {
  const configuredRoots = parseConfiguredRoots();
  if (configuredRoots.length > 0) {
    return configuredRoots.filter(isDirectory);
  }

  const roots = [DEFAULT_SESSION_ROOT, ...discoverWslSessionRoots()];
  return [...new Set(roots.map(normalizeRoot))].filter(isDirectory);
}

function getSessionRoots(): string[] {
  const configuredRootsKey = process.env.COPILOT_SESSION_STATE ?? null;
  const now = Date.now();

  if (
    sessionRootsCache &&
    sessionRootsCache.configuredRootsKey === configuredRootsKey &&
    now - sessionRootsCache.discoveredAt < ROOT_DISCOVERY_TTL_MS
  ) {
    return sessionRootsCache.roots.filter(isDirectory);
  }

  const roots = discoverSessionRoots();
  sessionRootsCache = { configuredRootsKey, roots, discoveredAt: now };
  return roots;
}

function findSessionDir(sessionId: string): string | null {
  for (const root of getSessionRoots()) {
    const sessionDir = path.join(root, sessionId);
    if (isDirectory(sessionDir)) {
      return sessionDir;
    }
  }

  return null;
}

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

function normalizeMessageText(content: string): string {
  return content.replace(/<[^>]+>/g, '').trim();
}

function titleFromContent(content?: string): string {
  if (!content) return 'Untitled session';
  const text = normalizeMessageText(content);
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}

function extractTitle(messages: ParsedMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  return titleFromContent(firstUser?.content);
}

const ABORTED_ERROR = { message: 'Operation aborted by user', code: 'aborted' } as const;

function buildMessagesFromEvents(events: RawEvent[], parentToolCallId?: string, isOpen = true): ParsedMessage[] {
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
        if (exec) return { ...tr, result: exec.result, error: exec.error };
        // Session closed with no completion event → tool was aborted
        if (!isOpen) return { ...tr, error: ABORTED_ERROR };
        return tr;
      });
      messages.push({
        id: event.id,
        role: 'assistant',
        content: data.content,
        reasoning: data.reasoningText,
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

function buildMessages(events: RawEvent[], isOpen: boolean): ParsedMessage[] {
  return buildMessagesFromEvents(events, undefined, isOpen);
}

function buildSubAgentMessages(events: RawEvent[], agents: ActiveSubAgent[], isOpen: boolean): Record<string, ParsedMessage[]> {
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
      result[agent.toolCallId] = buildMessagesFromEvents(events, agent.toolCallId, isOpen);
    }
  }
  return result;
}

function buildActiveSubAgents(events: RawEvent[]): ActiveSubAgent[] {
  // Accumulate all sub-agents across the entire session (never reset).
  // Each toolCallId is unique, so no duplicates.
  const started = new Map<string, { agentName: string; agentDisplayName: string; sessionId?: string }>();
  const completed = new Set<string>();
  const descriptions = new Map<string, string>();
  // track read_agent toolCallIds so we can detect their completion via tool.execution_complete
  const readAgentIds = new Set<string>();

  for (const event of events) {
    const isSubEvent = !!(event.data as Record<string, unknown>).parentToolCallId;
    if (isSubEvent) continue;

    if (event.type === 'assistant.message') {
      const data = event.data as unknown as AssistantMessageData;
      for (const tr of data.toolRequests ?? []) {
        if (tr.name === 'task' || tr.name === 'task_complete') {
          const args = tr.arguments as { description?: string };
          if (args.description) descriptions.set(tr.toolCallId, args.description);
        }
      }
    } else if (event.type === 'subagent.started') {
      const d = event.data as { toolCallId: string; agentName: string; agentDisplayName: string; sessionId?: string };
      started.set(d.toolCallId, { agentName: d.agentName, agentDisplayName: d.agentDisplayName, sessionId: d.sessionId });
    } else if (event.type === 'subagent.completed' || event.type === 'subagent.failed') {
      const d = event.data as { toolCallId: string };
      completed.add(d.toolCallId);
    } else if (event.type === 'tool.execution_start') {
      // read_agent calls spawn async agents without subagent.started events
      const d = event.data as { toolCallId: string; toolName: string; arguments: Record<string, unknown> };
      if (d.toolName === 'read_agent') {
        const agentId = d.arguments?.agent_id as string | undefined;
        readAgentIds.add(d.toolCallId);
        started.set(d.toolCallId, {
          agentName: 'read_agent',
          agentDisplayName: agentId ?? 'Read Agent',
        });
        if (agentId) descriptions.set(d.toolCallId, agentId);
      }
    } else if (event.type === 'tool.execution_complete') {
      const d = event.data as { toolCallId: string };
      if (readAgentIds.has(d.toolCallId)) {
        completed.add(d.toolCallId);
      }
    }
  }

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

function buildPreviewMessages(messages: ParsedMessage[]): MessagePreview[] {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const last2 = visible.slice(-2);
  return last2.map((m) => ({
    role: m.role as 'user' | 'assistant',
    snippet: normalizeMessageText(m.content).slice(0, 120),
    ...(m.toolRequests?.length ? { toolNames: m.toolRequests.map((t) => t.name) } : {}),
  }));
}

function getLockState(sessionDir: string): { isOpen: boolean; signature: string } {
  const lockFiles = fs
    .readdirSync(sessionDir)
    .filter((file) => file.startsWith('inuse.') && file.endsWith('.lock'))
    .sort();

  return {
    isOpen: lockFiles.length > 0,
    signature: lockFiles.length > 0 ? lockFiles.join('|') : 'closed',
  };
}

function hasLockFile(sessionDir: string): boolean {
  return getLockState(sessionDir).isOpen;
}

function getFileSignature(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

function appendPreviewMessage(previewMessages: MessagePreview[], message: MessagePreview): void {
  if (previewMessages.length === 2) {
    previewMessages.shift();
  }
  previewMessages.push(message);
}

function getParentToolCallId(event: RawEvent): string | undefined {
  const parentToolCallId = (event.data as Record<string, unknown>).parentToolCallId;
  return typeof parentToolCallId === 'string' ? parentToolCallId : undefined;
}

function getTurnId(event: RawEvent): string | undefined {
  const turnId = (event.data as Record<string, unknown>).turnId;
  return typeof turnId === 'string' ? turnId : undefined;
}

function getAssistantTurnKey(event: RawEvent): string {
  const turnId = getTurnId(event);
  if (turnId) {
    return `turn:${turnId}`;
  }

  return `thread:${getParentToolCallId(event) ?? '__root__'}`;
}

function parseTimestampMs(timestamp: string): number | null {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? null : value;
}

function getUsageEstimateFromAssistantTurns(events: RawEvent[], fallbackTimestamp: string): Pick<
  SessionUsageMetrics,
  'totalApiDurationEstimateMs' | 'totalPremiumRequestsEstimate'
> {
  // Live fallback only: this is a heuristic derived from observed assistant-turn timing
  // and completed turn count, not an exact premium-billing counter.
  const openTurns = new Map<string, number>();
  let totalApiDurationEstimateMs = 0;
  let totalPremiumRequestsEstimate = 0;

  for (const event of events) {
    const timestampMs = parseTimestampMs(event.timestamp);
    if (timestampMs === null) continue;

    if (event.type === 'assistant.turn_start') {
      const turnKey = getAssistantTurnKey(event);
      const existingStartedAt = openTurns.get(turnKey);

      if (existingStartedAt !== undefined) {
        totalApiDurationEstimateMs += Math.max(0, timestampMs - existingStartedAt);
      }

      openTurns.set(turnKey, timestampMs);
      continue;
    }

    if (event.type === 'assistant.turn_end') {
      const turnKey = getAssistantTurnKey(event);
      const startedAt = openTurns.get(turnKey);
      if (startedAt === undefined) continue;

      totalApiDurationEstimateMs += Math.max(0, timestampMs - startedAt);
      openTurns.delete(turnKey);
      totalPremiumRequestsEstimate += 1;
    }
  }

  const fallbackTimestampMs = parseTimestampMs(fallbackTimestamp);
  if (fallbackTimestampMs !== null) {
    for (const startedAt of openTurns.values()) {
      totalApiDurationEstimateMs += Math.max(0, fallbackTimestampMs - startedAt);
    }
  }

  return {
    totalApiDurationEstimateMs,
    totalPremiumRequestsEstimate,
  };
}

function buildSessionUsageMetrics(
  events: RawEvent[],
  fallbackTimestamp: string,
  shutdownData?: ShutdownData,
  shutdownTimestamp?: string,
): SessionUsageMetrics {
  const shutdownTimestampMs = shutdownTimestamp ? parseTimestampMs(shutdownTimestamp) : null;
  const estimateEvents =
    shutdownTimestampMs === null
      ? events
      : events.filter((event) => {
        const timestampMs = parseTimestampMs(event.timestamp);
        return timestampMs !== null && timestampMs > shutdownTimestampMs;
      });
  const { totalApiDurationEstimateMs, totalPremiumRequestsEstimate } = getUsageEstimateFromAssistantTurns(
    estimateEvents,
    fallbackTimestamp,
  );
  const hasShutdownApiDuration = typeof shutdownData?.totalApiDurationMs === 'number';
  const hasShutdownPremiumRequests = typeof shutdownData?.totalPremiumRequests === 'number';
  const hasEstimatedApiDelta = totalApiDurationEstimateMs > 0;
  const hasEstimatedPremiumDelta = totalPremiumRequestsEstimate > 0;

  return {
    totalApiDurationMs: hasShutdownApiDuration ? shutdownData.totalApiDurationMs : null,
    totalApiDurationEstimateMs: hasShutdownApiDuration
      ? shutdownData.totalApiDurationMs + totalApiDurationEstimateMs
      : totalApiDurationEstimateMs,
    totalApiDurationSource: hasShutdownApiDuration
      ? (hasEstimatedApiDelta ? 'shutdown_plus_assistant_turn_estimate' : 'shutdown')
      : 'assistant_turn_estimate',
    totalPremiumRequests: hasShutdownPremiumRequests ? shutdownData.totalPremiumRequests : null,
    totalPremiumRequestsEstimate: hasShutdownPremiumRequests
      ? shutdownData.totalPremiumRequests + totalPremiumRequestsEstimate
      : totalPremiumRequestsEstimate,
    totalPremiumRequestsSource: hasShutdownPremiumRequests
      ? (hasEstimatedPremiumDelta ? 'shutdown_plus_assistant_turn_estimate' : 'shutdown')
      : 'assistant_turn_estimate',
  };
}

function isRootThreadEvent(event: RawEvent): boolean {
  return getParentToolCallId(event) === undefined;
}

function createStubSessionSummary(sessionId: string, now = new Date().toISOString()): SessionSummary {
  return {
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
    totalApiDurationMs: null,
    totalApiDurationEstimateMs: 0,
    totalApiDurationSource: 'assistant_turn_estimate',
    totalPremiumRequests: null,
    totalPremiumRequestsEstimate: 0,
    totalPremiumRequestsSource: 'assistant_turn_estimate',
    currentMode: 'interactive',
    activeSubAgents: [],
    hasPlan: false,
    isPlanPending: false,
    previewMessages: [],
  };
}

function createStubSessionDetail(sessionId: string): SessionDetail {
  return {
    ...createStubSessionSummary(sessionId),
    messages: [],
    subAgentMessages: {},
  };
}

function reduceEventForSessionSummary(event: RawEvent): RawEvent | null {
  const parentToolCallId = getParentToolCallId(event);

  switch (event.type) {
    case 'user.message':
      return { ...event, data: parentToolCallId ? { parentToolCallId } : {} };
    case 'assistant.message': {
      const data = event.data as unknown as AssistantMessageData;
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          ...(data.toolRequests ? { toolRequests: data.toolRequests } : {}),
        },
      };
    }
    case 'tool.execution_start': {
      const data = event.data as { toolCallId?: string; toolName?: string; arguments?: Record<string, unknown> };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          ...(data.arguments ? { arguments: data.arguments } : {}),
        },
      };
    }
    case 'tool.execution_complete': {
      const data = event.data as { toolCallId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
        },
      };
    }
    case 'session.mode_changed': {
      const data = event.data as { newMode?: string };
      return { ...event, data: { newMode: data.newMode } };
    }
    case 'subagent.started': {
      const data = event.data as {
        toolCallId?: string;
        agentName?: string;
        agentDisplayName?: string;
        sessionId?: string;
      };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
          agentName: data.agentName,
          agentDisplayName: data.agentDisplayName,
          ...(data.sessionId ? { sessionId: data.sessionId } : {}),
        },
      };
    }
    case 'subagent.completed':
    case 'subagent.failed': {
      const data = event.data as { toolCallId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
        },
      };
    }
    case 'assistant.turn_start':
    case 'assistant.turn_end': {
      const data = event.data as { turnId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          ...(data.turnId ? { turnId: data.turnId } : {}),
        },
      };
    }
    case 'session.task_complete':
    case 'abort':
      return { ...event, data: {} };
    default:
      return null;
  }
}

function scanSessionSummary(eventsFile: string): SessionSummaryScan | null {
  try {
    const reducerEvents: RawEvent[] = [];
    const previewMessages: MessagePreview[] = [];
    const content = fs.readFileSync(eventsFile, 'utf8');

    let startData: SessionStartData | undefined;
      let startedAt: string | undefined;
      let shutdownData: ShutdownData | undefined;
      let lastShutdownAt: string | undefined;
      let lastModelChange: string | undefined;
      let lastActivityAt: string | undefined;
      let firstUserContent: string | undefined;
    let messageCount = 0;
    let eventCount = 0;
    let lineStart = 0;

    for (let index = 0; index <= content.length; index += 1) {
      if (index !== content.length && content.charCodeAt(index) !== 10) continue;

      let line = content.slice(lineStart, index);
      lineStart = index + 1;
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      if (line.trim().length === 0) {
        continue;
      }

      const event = JSON.parse(line) as RawEvent;
      eventCount += 1;
      lastActivityAt = event.timestamp;

      if (event.type === 'session.start' && !startData) {
        startData = event.data as unknown as SessionStartData;
        startedAt = startData.startTime ?? event.timestamp;
        continue;
      }

      if (event.type === 'session.shutdown') {
        shutdownData = event.data as unknown as ShutdownData;
        lastShutdownAt = event.timestamp;
        continue;
      }

      if (event.type === 'session.model_change') {
        const data = event.data as { newModel?: string };
        lastModelChange = data.newModel ?? lastModelChange;
        continue;
      }

      if (event.type === 'user.message' && isRootThreadEvent(event)) {
        const data = event.data as unknown as UserMessageData;
        if (!firstUserContent) {
          firstUserContent = data.content;
        }
        messageCount += 1;
        appendPreviewMessage(previewMessages, {
          role: 'user',
          snippet: normalizeMessageText(data.content).slice(0, 120),
        });
      } else if (event.type === 'assistant.message' && isRootThreadEvent(event)) {
        const data = event.data as unknown as AssistantMessageData;
        appendPreviewMessage(previewMessages, {
          role: 'assistant',
          snippet: normalizeMessageText(data.content).slice(0, 120),
          ...(data.toolRequests?.length ? { toolNames: data.toolRequests.map((tool) => tool.name) } : {}),
        });
      }

      const reducedEvent = reduceEventForSessionSummary(event);
      if (reducedEvent) {
        reducerEvents.push(reducedEvent);
      }
    }

    return {
      reducerEvents,
      eventCount,
      startData,
      startedAt,
      shutdownData,
      lastShutdownAt,
      lastModelChange,
      lastActivityAt,
      firstUserContent,
      messageCount,
      previewMessages,
    };
  } catch {
    return null;
  }
}

function parseSessionSummaryAtPath(sessionDir: string, sessionId: string): SessionSummary | null {
  const eventsFile = path.join(sessionDir, 'events.jsonl');
  const planFile = path.join(sessionDir, 'plan.md');
  const lockState = getLockState(sessionDir);
  const isOpen = lockState.isOpen;
  const signature = [
    getFileSignature(eventsFile),
    getFileSignature(planFile),
    lockState.signature,
  ].join('|');
  const cached = sessionSummaryCache.get(sessionDir);
  if (cached?.signature === signature) {
    return cached.summary;
  }

  const scan = fs.existsSync(eventsFile) ? scanSessionSummary(eventsFile) : null;

  if (!scan || scan.eventCount === 0 || !scan.startData || !scan.startedAt) {
    const summary = isOpen ? createStubSessionSummary(sessionId) : null;
    sessionSummaryCache.set(sessionDir, { signature, summary });
    return summary;
  }

  const currentMode = getCurrentMode(scan.reducerEvents);
  const sessionStatus = lastSessionStatus(scan.reducerEvents);
  const activeSubAgents = buildActiveSubAgents(scan.reducerEvents);
  const hasPlan = fs.existsSync(planFile);
  const lastActivityAt = scan.lastActivityAt ?? scan.startedAt;
  const usageMetrics = buildSessionUsageMetrics(
    scan.reducerEvents,
    lastActivityAt,
    scan.shutdownData,
    scan.lastShutdownAt,
  );

  const summary: SessionSummary = {
    id: sessionId,
    title: titleFromContent(scan.firstUserContent),
    projectPath: scan.startData.context?.cwd ?? 'Unknown',
    gitBranch: scan.startData.context?.branch ?? null,
    startedAt: scan.startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(scan.startedAt),
    isOpen,
    needsAttention: needsAttention(scan.reducerEvents, isOpen),
    isWorking: isOpen && (sessionStatus === 'working' || hasPendingWork(scan.reducerEvents)),
    isAborted: isOpen && sessionStatus === 'aborted',
    isTaskComplete: isOpen && sessionStatus === 'task_complete',
    isIdle: isOpen && sessionStatus === 'idle',
    messageCount: scan.messageCount,
    model: scan.lastModelChange ?? scan.shutdownData?.currentModel,
    ...usageMetrics,
    currentMode,
    activeSubAgents,
    hasPlan,
    isPlanPending: isOpen && hasPendingPlanApproval(scan.reducerEvents),
    previewMessages: scan.previewMessages,
  };

  sessionSummaryCache.set(sessionDir, { signature, summary });
  return summary;
}

function shouldIncludeSessionInList(summary: SessionSummary): boolean {
  return summary.isOpen || summary.messageCount > 0;
}

function parseSessionDirAtPath(sessionDir: string, sessionId: string): SessionDetail | null {
  const eventsFile = path.join(sessionDir, 'events.jsonl');

  const hasLockFilePresent = hasLockFile(sessionDir);
  // Lock file is the source of truth: present = process is running, even if a
  // prior run wrote a session.shutdown (e.g. a resumed session).
  const isOpen = hasLockFilePresent;

  const events = fs.existsSync(eventsFile) ? parseEventsFile(eventsFile) : [];

  const startEvent = events.find((e) => e.type === 'session.start');
  const shutdownEvent = [...events].reverse().find((e) => e.type === 'session.shutdown');

  // Brand-new session: lock file exists but events not yet written — show as
  // a placeholder so it appears immediately in the list.
  if (events.length === 0 || !startEvent) {
    return isOpen ? createStubSessionDetail(sessionId) : null;
  }

  const startData = startEvent.data as unknown as SessionStartData;
  const startedAt = startData.startTime ?? startEvent.timestamp;

  const messages = buildMessages(events, isOpen);
  const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;

  const shutdownData = shutdownEvent?.data as unknown as ShutdownData | undefined;
  const usageMetrics = buildSessionUsageMetrics(events, lastActivityAt, shutdownData, shutdownEvent?.timestamp);
  // Prefer the last model_change event (covers active sessions); fall back to shutdown metadata
  const lastModelChange = [...events].reverse().find((e) => e.type === 'session.model_change');
  const model =
    (lastModelChange?.data as unknown as { newModel?: string } | undefined)?.newModel ??
    shutdownData?.currentModel;

  const activeSubAgents = buildActiveSubAgents(events);
  const subAgentMessages = buildSubAgentMessages(events, activeSubAgents, isOpen);

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
    ...usageMetrics,
    currentMode: getCurrentMode(events),
    activeSubAgents,
    hasPlan,
    isPlanPending,
    previewMessages: buildPreviewMessages(messages),
  };

  const todos = readTodos(sessionDir);

  return { ...summary, messages, subAgentMessages, planContent, todos };
}

export function parseSessionDir(sessionId: string): SessionDetail | null {
  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) return null;
  return parseSessionDirAtPath(sessionDir, sessionId);
}

export function listAllSessions(): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  const seenSessionIds = new Set<string>();
  const seenSessionDirs = new Set<string>();

  for (const root of getSessionRoots()) {
    const entries = fs.readdirSync(root, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || seenSessionIds.has(entry.name)) continue;
      seenSessionIds.add(entry.name);

      const sessionDir = path.join(root, entry.name);
      seenSessionDirs.add(sessionDir);
      const summary = parseSessionSummaryAtPath(sessionDir, entry.name);
      if (summary && shouldIncludeSessionInList(summary)) {
        sessions.push(summary);
      }
    }
  }

  for (const cachedSessionDir of sessionSummaryCache.keys()) {
    if (!seenSessionDirs.has(cachedSessionDir)) {
      sessionSummaryCache.delete(cachedSessionDir);
    }
  }

  // Sort by last activity, newest first
  return sessions.sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
  );
}
