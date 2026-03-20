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
export function getCurrentMode(events: RawEvent[]): string {
  let mode = 'interactive';
  const exitPlanStarted = new Map<string, true>();

  for (const event of events) {
    if (event.type === 'session.mode_changed') {
      mode = (event.data as { newMode?: string }).newMode ?? mode;
    } else if (event.type === 'tool.execution_start' && event.data['toolName'] === 'exit_plan_mode') {
      exitPlanStarted.set(event.data['toolCallId'] as string, true);
    } else if (event.type === 'tool.execution_complete') {
      // When exit_plan_mode is approved it completes — session is back to interactive
      if (exitPlanStarted.has(event.data['toolCallId'] as string)) {
        mode = 'interactive';
        exitPlanStarted.delete(event.data['toolCallId'] as string);
      }
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

// Non-bash tools pending > 1 minute without completion are likely awaiting user approval.
// bash is excluded entirely — tests and builds run autonomously and can take many minutes.
// In approval mode, hasPendingUserInteraction already catches pending bash.
function hasStuckPendingTool(events: RawEvent[]): boolean {
  const started = new Map<string, { toolName: string; timestamp: number }>();

  for (const event of events) {
    if (event.type === 'tool.execution_start') {
      const id = event.data['toolCallId'] as string;
      const toolName = event.data['toolName'] as string;
      started.set(id, { toolName, timestamp: Date.parse(event.timestamp) });
    } else if (event.type === 'tool.execution_complete') {
      started.delete(event.data['toolCallId'] as string);
    } else if (event.type === 'abort') {
      started.clear();
    }
  }

  const now = Date.now();
  const ONE_MINUTE = 60 * 1000;

  // Non-bash tools pending > 1 minute are likely stuck (edit/read/task etc. are always fast).
  // Bash is excluded — tests and builds run autonomously and can take many minutes.
  for (const { toolName, timestamp } of started.values()) {
    if (toolName === 'bash') continue;
    if (now - timestamp > ONE_MINUTE) return true;
  }

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
