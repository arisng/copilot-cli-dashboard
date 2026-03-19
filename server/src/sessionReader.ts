import fs from 'fs';
import path from 'path';
import os from 'os';
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
} from './sessionTypes.js';
import { needsAttention, lastSessionStatus } from './utils/needsAttention.js';

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

function buildMessages(events: RawEvent[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Pre-build a map of toolCallId → execution result/error
  const toolResults = new Map<string, ToolExecutionCompleteData>();
  for (const event of events) {
    if (event.type === 'tool.execution_complete') {
      const d = event.data as unknown as ToolExecutionCompleteData;
      toolResults.set(d.toolCallId, d);
    }
  }

  for (const event of events) {
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
      const data = event.data as unknown as { summary: string };
      messages.push({
        id: event.id,
        role: 'task_complete',
        content: data.summary,
        timestamp: event.timestamp,
      });
    }
  }

  return messages;
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
      messages: [],
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
    isWorking: isOpen && lastSessionStatus(events) === 'working',
    isAborted: isOpen && lastSessionStatus(events) === 'aborted',
    isTaskComplete: isOpen && lastSessionStatus(events) === 'task_complete',
    isIdle: isOpen && lastSessionStatus(events) === 'idle',
    messageCount: messages.filter((m) => m.role === 'user').length,
    model,
  };

  return { ...summary, messages };
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
