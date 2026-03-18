import fs from 'fs';
import path from 'path';
import os from 'os';
import type {
  RawEvent,
  SessionStartData,
  UserMessageData,
  AssistantMessageData,
  ShutdownData,
  ParsedMessage,
  SessionSummary,
  SessionDetail,
} from './sessionTypes.js';
import { needsAttention } from './utils/needsAttention.js';

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
      messages.push({
        id: event.id,
        role: 'assistant',
        content: data.content,
        toolRequests: data.toolRequests,
        timestamp: event.timestamp,
        interactionId: data.interactionId,
      });
    }
  }

  return messages;
}

export function parseSessionDir(sessionId: string): SessionDetail | null {
  const sessionDir = path.join(SESSIONS_BASE, sessionId);
  const eventsFile = path.join(sessionDir, 'events.jsonl');

  if (!fs.existsSync(eventsFile)) return null;

  const events = parseEventsFile(eventsFile);
  if (events.length === 0) return null;

  const startEvent = events.find((e) => e.type === 'session.start');
  const shutdownEvent = events.find((e) => e.type === 'session.shutdown');

  if (!startEvent) return null;

  const startData = startEvent.data as unknown as SessionStartData;
  const startedAt = startData.startTime ?? startEvent.timestamp;
  const isOpen = !shutdownEvent;

  const messages = buildMessages(events);
  const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;

  const shutdownData = shutdownEvent?.data as unknown as ShutdownData | undefined;
  const model = shutdownData?.currentModel;

  const summary: SessionSummary = {
    id: sessionId,
    title: extractTitle(messages),
    projectPath: startData.context?.cwd ?? 'Unknown',
    gitBranch: startData.context?.branch ?? null,
    startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(startedAt),
    isOpen,
    needsAttention: needsAttention(messages, lastActivityAt, isOpen),
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
