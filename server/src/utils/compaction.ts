import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import type { RawEvent } from '../sessionTypes.js';

export interface CompactionOptions {
  ageThresholdDays: number;
  compressEvents: boolean;
  deduplicateToolResults: boolean;
}

export interface CompactionResult {
  sessionId: string;
  bytesBefore: number;
  bytesAfter: number;
  bytesSaved: number;
  eventsRemoved: number;
  eventsCompressed: number;
}

interface CompactionEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  id: string;
  parentId: string | null;
}

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

/**
 * Parse events from a session directory.
 * Handles both events.jsonl and events.jsonl.gz (compressed).
 */
function parseEventsFile(sessionDir: string): CompactionEvent[] {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  const compressedPath = `${eventsPath}.gz`;

  try {
    let content: string;

    // Try uncompressed first
    if (fs.existsSync(eventsPath)) {
      content = fs.readFileSync(eventsPath, 'utf8');
    } else if (fs.existsSync(compressedPath)) {
      // Skip compressed files during compaction - they are already optimized
      return [];
    } else {
      return [];
    }

    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as CompactionEvent);
  } catch {
    return [];
  }
}

/**
 * Check if two tool execution results are duplicates.
 */
function isDuplicateToolResult(
  event1: CompactionEvent,
  event2: CompactionEvent
): boolean {
  if (event1.type !== 'tool.execution_complete' || event2.type !== 'tool.execution_complete') {
    return false;
  }

  const data1 = event1.data;
  const data2 = event2.data;

  // Compare tool names
  if (data1.toolName !== data2.toolName) return false;

  // Compare success status
  if (data1.success !== data2.success) return false;

  // Compare result content (truncated comparison for large results)
  const result1 = data1.result as { content?: string } | undefined;
  const result2 = data2.result as { content?: string } | undefined;

  if (result1?.content && result2?.content) {
    // For large results, compare first and last 100 chars
    const content1 = result1.content;
    const content2 = result2.content;

    if (content1.length > 500 || content2.length > 500) {
      const prefix1 = content1.slice(0, 100);
      const prefix2 = content2.slice(0, 100);
      const suffix1 = content1.slice(-100);
      const suffix2 = content2.slice(-100);

      return prefix1 === prefix2 && suffix1 === suffix2;
    }

    return content1 === content2;
  }

  // Compare error messages
  const error1 = data1.error as { message?: string } | undefined;
  const error2 = data2.error as { message?: string } | undefined;

  if (error1?.message !== error2?.message) return false;

  return true;
}

/**
 * Determine if an event can be safely removed during compaction.
 */
function isRemovableEvent(event: CompactionEvent, options: CompactionOptions): boolean {
  // Never remove session lifecycle events
  if (
    event.type === 'session.start' ||
    event.type === 'session.resume' ||
    event.type === 'session.shutdown' ||
    event.type === 'session.task_complete'
  ) {
    return false;
  }

  // Never remove user messages
  if (event.type === 'user.message') {
    return false;
  }

  // Can remove redundant assistant.turn_end if followed by turn_start
  if (event.type === 'assistant.turn_end') {
    return true;
  }

  // Can remove intermediate assistant messages that only contain reasoning
  // and no tool requests (these are often intermediate thoughts)
  if (event.type === 'assistant.message') {
    const data = event.data as { content?: string; toolRequests?: unknown[]; reasoningText?: string };
    const hasContent = data.content && data.content.trim().length > 0;
    const hasToolRequests = data.toolRequests && data.toolRequests.length > 0;

    // Keep if it has content or tool requests
    if (hasContent || hasToolRequests) return false;

    // Remove if it's just reasoning with no content/tools
    return !!(data.reasoningText && data.reasoningText.length > 0);
  }

  // Check for old events based on age threshold
  if (options.ageThresholdDays > 0) {
    const eventDate = new Date(event.timestamp).getTime();
    const ageMs = Date.now() - eventDate;
    const thresholdMs = options.ageThresholdDays * DAYS_TO_MS;

    // Old heartbeat and info events can be removed
    if (ageMs > thresholdMs && (event.type === 'session.info' || event.type === 'session.model_change')) {
      return true;
    }
  }

  return false;
}

/**
 * Compact a session by removing redundant events and compressing old data.
 */
export async function compactSession(
  sessionDir: string,
  options: CompactionOptions
): Promise<CompactionResult> {
  const sessionId = path.basename(sessionDir);
  const eventsPath = path.join(sessionDir, 'events.jsonl');

  const result: CompactionResult = {
    sessionId,
    bytesBefore: 0,
    bytesAfter: 0,
    bytesSaved: 0,
    eventsRemoved: 0,
    eventsCompressed: 0,
  };

  // Check if events file exists
  if (!fs.existsSync(eventsPath)) {
    return result;
  }

  const stat = fs.statSync(eventsPath);
  result.bytesBefore = stat.size;

  // Parse events
  const events = parseEventsFile(sessionDir);
  if (events.length === 0) {
    return result;
  }

  // Sort by timestamp to ensure proper order
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Deduplicate tool results if enabled
  let deduplicatedEvents = events;
  if (options.deduplicateToolResults) {
    const seenToolResults = new Map<string, CompactionEvent>();
    deduplicatedEvents = [];

    for (const event of events) {
      if (event.type === 'tool.execution_complete') {
        const toolCallId = event.data.toolCallId as string;
        const existing = seenToolResults.get(toolCallId);

        if (existing && isDuplicateToolResult(existing, event)) {
          // Skip duplicate
          result.eventsRemoved++;
          continue;
        }

        seenToolResults.set(toolCallId, event);
      }

      deduplicatedEvents.push(event);
    }
  }

  // Remove redundant events
  const compactedEvents: CompactionEvent[] = [];
  let lastEvent: CompactionEvent | null = null;

  for (const event of deduplicatedEvents) {
    // Skip consecutive identical state events
    if (
      lastEvent &&
      event.type === lastEvent.type &&
      event.type.startsWith('session.') &&
      event.type !== 'session.start' &&
      event.type !== 'session.shutdown'
    ) {
      result.eventsRemoved++;
      continue;
    }

    // Skip removable events
    if (isRemovableEvent(event, options)) {
      result.eventsRemoved++;
      continue;
    }

    compactedEvents.push(event);
    lastEvent = event;
  }

  // Write compacted events
  const tempPath = `${eventsPath}.tmp`;
  const output = compactedEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';

  fs.writeFileSync(tempPath, output);
  fs.renameSync(tempPath, eventsPath);

  // Update stats
  const newStat = fs.statSync(eventsPath);
  result.bytesAfter = newStat.size;
  result.bytesSaved = result.bytesBefore - result.bytesAfter;

  // Compress if enabled and old enough
  if (options.compressEvents) {
    await compressOldEvents(sessionDir, options.ageThresholdDays);
  }

  return result;
}

/**
 * Compress old events.jsonl files to .gz format.
 * Keeps recent events uncompressed for quick access.
 */
export async function compressOldEvents(
  sessionDir: string,
  ageThresholdDays: number
): Promise<void> {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  const compressedPath = `${eventsPath}.gz`;

  // Skip if already compressed or doesn't exist
  if (!fs.existsSync(eventsPath) || fs.existsSync(compressedPath)) {
    return;
  }

  // Check if file is old enough to compress
  const stat = fs.statSync(eventsPath);
  const ageMs = Date.now() - stat.mtimeMs;
  const thresholdMs = ageThresholdDays * DAYS_TO_MS;

  if (ageMs < thresholdMs) {
    return;
  }

  try {
    await pipeline(
      createReadStream(eventsPath),
      createGzip(),
      createWriteStream(compressedPath)
    );

    // Verify compression succeeded before removing original
    const compressedStat = fs.statSync(compressedPath);
    if (compressedStat.size > 0) {
      fs.unlinkSync(eventsPath);
    } else {
      // Compression failed, remove empty compressed file
      fs.unlinkSync(compressedPath);
      throw new Error('Compression produced empty file');
    }
  } catch (err) {
    // Clean up on error
    try {
      if (fs.existsSync(compressedPath)) {
        fs.unlinkSync(compressedPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Batch compact multiple sessions.
 */
export async function batchCompactSessions(
  sessionDirs: string[],
  options: CompactionOptions
): Promise<CompactionResult[]> {
  const results: CompactionResult[] = [];

  for (const sessionDir of sessionDirs) {
    try {
      const result = await compactSession(sessionDir, options);
      results.push(result);
    } catch (err) {
      console.error(`Failed to compact ${sessionDir}:`, err);
    }
  }

  return results;
}

/**
 * Get compaction statistics for a session.
 */
export function getSessionCompactionStats(sessionDir: string): {
  totalEvents: number;
  compressed: boolean;
  sizeBytes: number;
} {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  const compressedPath = `${eventsPath}.gz`;

  // Check if compressed
  const isCompressed = fs.existsSync(compressedPath);
  const targetPath = isCompressed ? compressedPath : eventsPath;

  if (!fs.existsSync(targetPath)) {
    return { totalEvents: 0, compressed: false, sizeBytes: 0 };
  }

  const stat = fs.statSync(targetPath);

  // If compressed, we can't easily count events without decompression
  // Return 0 for compressed files
  return {
    totalEvents: isCompressed ? 0 : parseEventsFile(sessionDir).length,
    compressed: isCompressed,
    sizeBytes: stat.size,
  };
}
