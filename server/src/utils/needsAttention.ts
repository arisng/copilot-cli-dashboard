import type { RawEvent } from '../sessionTypes.js';

// Only tools that require explicit user interaction should trigger needsAttention.
// Long-running tools like bash (tests, builds) are just the agent working autonomously.
const USER_INTERACTION_TOOLS = new Set(['ask_user', 'exit_plan_mode']);

// MCP tools (mcp-* prefix) always require explicit user approval before executing.
// A pending mcp-* tool.execution_start with no matching complete means the user
// is being shown a permission prompt in the terminal.
function requiresUserApproval(toolName: string, inApprovalMode: boolean): boolean {
  return USER_INTERACTION_TOOLS.has(toolName) || toolName.startsWith('mcp-') || inApprovalMode;
}

// In plan/cautious mode every tool call requires explicit user approval before it
// runs — tool.execution_start fires when the approval prompt appears, so any
// pending start (no matching complete) means the user hasn't responded yet.
function getCurrentMode(events: RawEvent[]): string {
  let mode = 'interactive';
  for (const event of events) {
    if (event.type === 'session.mode_changed') {
      mode = (event.data as { newMode?: string }).newMode ?? mode;
    }
  }
  return mode;
}

function buildPendingTools(events: RawEvent[]): Map<string, string> {
  const started = new Map<string, string>();
  const completed = new Set<string>();

  for (const event of events) {
    if (event.type === 'tool.execution_start') {
      started.set(event.data['toolCallId'] as string, event.data['toolName'] as string);
    } else if (event.type === 'tool.execution_complete') {
      completed.add(event.data['toolCallId'] as string);
    } else if (event.type === 'abort') {
      started.clear();
      completed.clear();
    }
  }

  // Return only the uncompleted ones
  for (const id of completed) started.delete(id);
  return started;
}

function hasPendingUserInteraction(events: RawEvent[]): boolean {
  const inApprovalMode = getCurrentMode(events) !== 'interactive';
  const pending = buildPendingTools(events);
  return [...pending.values()].some((name) => requiresUserApproval(name, inApprovalMode));
}

// Any tool pending > 1 minute without completion is likely awaiting user approval.
// bash gets extra leeway via initial_wait (e.g. mvn test with initial_wait=60 → 120s threshold).
// Everything else (edit, task, view, mcp-*, etc.) uses the flat 60s threshold.
function hasStuckPendingTool(events: RawEvent[]): boolean {
  const started = new Map<string, { toolName: string; timestamp: number; initialWait: number }>();
  let lastTurnStartTs = 0;

  for (const event of events) {
    if (event.type === 'tool.execution_start') {
      const id = event.data['toolCallId'] as string;
      const toolName = event.data['toolName'] as string;
      const args = (event.data['arguments'] as Record<string, unknown>) ?? {};
      const initialWait = typeof args['initial_wait'] === 'number' ? (args['initial_wait'] as number) : 0;
      started.set(id, { toolName, timestamp: Date.parse(event.timestamp), initialWait });
    } else if (event.type === 'tool.execution_complete') {
      started.delete(event.data['toolCallId'] as string);
    } else if (event.type === 'abort') {
      started.clear();
      lastTurnStartTs = 0;
    } else if (event.type === 'assistant.turn_start') {
      lastTurnStartTs = Date.parse(event.timestamp);
    } else if (event.type === 'assistant.turn_end' || event.type === 'user.message') {
      lastTurnStartTs = 0;
    }
  }

  const now = Date.now();
  const ONE_MINUTE = 60 * 1000;

  // Any tool pending > 1 minute (bash with initial_wait gets extra buffer)
  for (const { toolName, timestamp, initialWait } of started.values()) {
    const threshold = toolName === 'bash'
      ? (initialWait + 60) * 1000
      : ONE_MINUTE;
    if (now - timestamp > threshold) return true;
  }

  // Generation phase stuck > 1 minute (assistant.turn_start with no message yet)
  if (lastTurnStartTs > 0 && now - lastTurnStartTs > ONE_MINUTE) return true;

  return false;
}

export function needsAttention(events: RawEvent[], isOpen: boolean): boolean {
  if (!isOpen) return false;
  return hasPendingUserInteraction(events) || hasStuckPendingTool(events);
}

// Returns true when exit_plan_mode has been called but not yet approved by the user.
export function hasPendingPlanApproval(events: RawEvent[]): boolean {
  const pending = buildPendingTools(events);
  return [...pending.values()].some((name) => name === 'exit_plan_mode');
}

// Returns true when there are tool executions in-flight that are NOT waiting for
// user approval (e.g. bash/read/edit running autonomously in the background).
// Used to keep isWorking = true even after assistant.turn_end.
export function hasPendingWork(events: RawEvent[]): boolean {
  const inApprovalMode = getCurrentMode(events) !== 'interactive';
  const pending = buildPendingTools(events);
  return [...pending.values()].some((name) => !requiresUserApproval(name, inApprovalMode));
}

// Scan forward through all events, tracking state per-turn so stale signals
// (e.g. an abort the agent already recovered from) don't affect the result.
export function lastSessionStatus(
  events: RawEvent[]
): 'aborted' | 'task_complete' | 'working' | 'idle' | null {
  let inTurn = false;
  let lastTurnHadTaskComplete = false;
  let pendingAbort = false;

  for (const event of events) {
    const type = event.type;
    if (type === 'user.message') {
      inTurn = false;
      lastTurnHadTaskComplete = false;
      pendingAbort = false;
    } else if (type === 'assistant.turn_start') {
      inTurn = true;
      lastTurnHadTaskComplete = false;
      pendingAbort = false;
    } else if (type === 'assistant.turn_end') {
      inTurn = false;
    } else if (type === 'session.task_complete') {
      lastTurnHadTaskComplete = true;
    } else if (type === 'abort') {
      pendingAbort = true;
      inTurn = false;
    }
  }

  if (inTurn) return 'working';
  if (pendingAbort) return 'aborted';
  if (lastTurnHadTaskComplete) return 'task_complete';
  // Turn ended cleanly — agent is done, waiting for next user message
  return 'idle';
}
