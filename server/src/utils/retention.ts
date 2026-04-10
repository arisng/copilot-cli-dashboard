import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { RawEvent } from '../sessionTypes.js';

export interface RetentionPolicy {
  state: 'closed' | 'aborted' | 'complete' | 'open';
  days: number; // 0 = never delete
}

export interface SessionRetentionInfo {
  sessionId: string;
  sessionDir: string;
  state: 'closed' | 'aborted' | 'complete' | 'open';
  lastActivityAt: Date;
  retentionDays: number;
  shouldDelete: boolean;
  deleteAfter: Date | null;
}

interface WorkspaceYaml {
  id?: string;
  updated_at?: string;
  created_at?: string;
}

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

/**
 * Get retention policies from environment variables.
 * Uses defaults if environment variables are not set.
 */
export function getRetentionPolicies(): RetentionPolicy[] {
  return [
    {
      state: 'closed',
      days: parseInt(process.env.COPILOT_RETENTION_DAYS_CLOSED || '30', 10),
    },
    {
      state: 'aborted',
      days: parseInt(process.env.COPILOT_RETENTION_DAYS_ABORTED || '7', 10),
    },
    {
      state: 'complete',
      days: parseInt(process.env.COPILOT_RETENTION_DAYS_COMPLETE || '90', 10),
    },
    {
      state: 'open',
      days: parseInt(process.env.COPILOT_RETENTION_DAYS_OPEN || '0', 10),
    },
  ];
}

/**
 * Check if a session directory has a lock file (is currently open).
 */
function hasLockFile(sessionDir: string): boolean {
  try {
    const entries = fs.readdirSync(sessionDir);
    return entries.some((entry) => entry.startsWith('inuse.') && entry.endsWith('.lock'));
  } catch {
    return false;
  }
}

/**
 * Read and parse workspace.yaml from session directory.
 */
function readWorkspaceYaml(sessionDir: string): WorkspaceYaml | null {
  const workspaceFile = path.join(sessionDir, 'workspace.yaml');
  try {
    const content = fs.readFileSync(workspaceFile, 'utf8');
    return yaml.load(content) as WorkspaceYaml;
  } catch {
    return null;
  }
}

/**
 * Parse events.jsonl and return all events.
 */
function parseEvents(sessionDir: string): RawEvent[] {
  const eventsFile = path.join(sessionDir, 'events.jsonl');
  try {
    const content = fs.readFileSync(eventsFile, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RawEvent);
  } catch {
    return [];
  }
}

/**
 * Determine session state based on events and lock file.
 * - 'open': Has lock file
 * - 'aborted': Last status was aborted (no lock file)
 * - 'complete': Last status was task_complete (no lock file)
 * - 'closed': Has shutdown event, no lock file
 */
function determineSessionState(events: RawEvent[], hasLock: boolean): 'closed' | 'aborted' | 'complete' | 'open' {
  if (hasLock) {
    return 'open';
  }

  // Scan events to determine final state
  let lastShutdownAt: string | null = null;
  let lastActivityStatus: 'aborted' | 'task_complete' | null = null;
  let inTurn = false;

  for (const event of events) {
    const type = event.type;

    if (type === 'session.shutdown') {
      lastShutdownAt = event.timestamp;
    } else if (type === 'user.message') {
      inTurn = false;
      lastActivityStatus = null;
    } else if (type === 'assistant.turn_start') {
      inTurn = true;
    } else if (type === 'assistant.turn_end') {
      inTurn = false;
    } else if (type === 'session.task_complete') {
      lastActivityStatus = 'task_complete';
    } else if (type === 'abort') {
      lastActivityStatus = 'aborted';
      inTurn = false;
    }
  }

  // If last activity was a task complete, session is complete
  if (lastActivityStatus === 'task_complete') {
    return 'complete';
  }

  // If last activity was an abort, session was aborted
  if (lastActivityStatus === 'aborted') {
    return 'aborted';
  }

  // Otherwise, it was cleanly closed
  return 'closed';
}

/**
 * Find the last activity timestamp from events or file system.
 */
function findLastActivityAt(
  sessionDir: string,
  events: RawEvent[],
  workspaceYaml: WorkspaceYaml | null
): Date {
  // First, try to get from events
  let lastTimestamp: string | null = null;

  for (const event of events) {
    if (event.timestamp) {
      if (!lastTimestamp || event.timestamp > lastTimestamp) {
        lastTimestamp = event.timestamp;
      }
    }
  }

  if (lastTimestamp) {
    return new Date(lastTimestamp);
  }

  // Fall back to workspace.yaml updated_at
  if (workspaceYaml?.updated_at) {
    return new Date(workspaceYaml.updated_at);
  }

  // Fall back to workspace.yaml created_at
  if (workspaceYaml?.created_at) {
    return new Date(workspaceYaml.created_at);
  }

  // Last resort: use file modification time of session directory
  try {
    const stat = fs.statSync(sessionDir);
    return new Date(stat.mtimeMs);
  } catch {
    // Ultimate fallback: current time (shouldn't happen in practice)
    return new Date();
  }
}

/**
 * Calculate retention information for a session directory.
 */
export function calculateRetention(sessionDir: string, sessionId: string): SessionRetentionInfo {
  const policies = getRetentionPolicies();
  const hasLock = hasLockFile(sessionDir);
  const events = parseEvents(sessionDir);
  const workspaceYaml = readWorkspaceYaml(sessionDir);

  // Determine session state
  const state = determineSessionState(events, hasLock);

  // Find last activity timestamp
  const lastActivityAt = findLastActivityAt(sessionDir, events, workspaceYaml);

  // Find applicable retention policy
  const policy = policies.find((p) => p.state === state);
  const retentionDays = policy?.days ?? 0;

  // Calculate if session should be deleted
  let shouldDelete = false;
  let deleteAfter: Date | null = null;

  if (retentionDays > 0) {
    const retentionMs = retentionDays * DAYS_TO_MS;
    const now = Date.now();
    const deleteAfterMs = lastActivityAt.getTime() + retentionMs;
    deleteAfter = new Date(deleteAfterMs);
    shouldDelete = now >= deleteAfterMs;
  }

  return {
    sessionId,
    sessionDir,
    state,
    lastActivityAt,
    retentionDays,
    shouldDelete,
    deleteAfter,
  };
}

/**
 * Get all session directories from a root path.
 */
export function getSessionDirectories(rootPath: string): Array<{ sessionId: string; sessionDir: string }> {
  try {
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        sessionId: entry.name,
        sessionDir: path.join(rootPath, entry.name),
      }));
  } catch {
    return [];
  }
}
