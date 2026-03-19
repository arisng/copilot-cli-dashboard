import type { RawEvent } from '../sessionTypes.js';

// A pending tool execution (started but not completed) means the agent is
// paused waiting for user interaction — either an ask_user question or a
// tool that requires approval.
function hasPendingToolExecution(events: RawEvent[]): boolean {
  const started = new Set<string>();
  const completed = new Set<string>();
  for (const event of events) {
    if (event.type === 'tool.execution_start') {
      started.add(event.data['toolCallId'] as string);
    } else if (event.type === 'tool.execution_complete') {
      completed.add(event.data['toolCallId'] as string);
    } else if (event.type === 'abort') {
      // Abort cancels all pending tool executions without emitting completions
      started.clear();
      completed.clear();
    }
  }
  return [...started].some((id) => !completed.has(id));
}

export function needsAttention(events: RawEvent[], isOpen: boolean): boolean {
  if (!isOpen) return false;
  return hasPendingToolExecution(events);
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
