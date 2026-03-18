import type { ParsedMessage } from '../sessionTypes.js';

const IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function needsAttention(
  messages: ParsedMessage[],
  lastActivityAt: string,
  isOpen: boolean
): boolean {
  // Closed sessions never need attention
  if (!isOpen) return false;

  // Idle for more than 30 minutes regardless of who sent the last message
  const idleTooLong = Date.now() - Date.parse(lastActivityAt) >= IDLE_THRESHOLD_MS;
  if (idleTooLong) return true;

  // Last conversational message is from the AI (waiting for user reply)
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return false;

  if (lastMsg.role === 'assistant') {
    // Only flag if the AI produced actual text content (not just tool calls)
    return lastMsg.content.trim().length > 0;
  }

  return false;
}
