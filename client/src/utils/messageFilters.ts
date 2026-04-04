import type { ParsedMessage } from '../api/client.ts';

export interface MessageFilterState {
  participants: Array<'user' | 'assistant' | 'task_complete'>;
  tools: string[];
  hasToolCall: boolean;
  hasReasoning: boolean;
  hasError: boolean;
  timeWindow: '30m' | '1h' | '6h' | '24h' | 'all';
  turnId: string | null;
}

export const DEFAULT_MESSAGE_FILTER_STATE: MessageFilterState = {
  participants: [],
  tools: [],
  hasToolCall: false,
  hasReasoning: false,
  hasError: false,
  timeWindow: 'all',
  turnId: null,
};

export interface TurnOption {
  turnId: string;
  label: string;
  messages: ParsedMessage[];
}

export function getMessageTools(messages: ParsedMessage[]): string[] {
  const tools = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolRequests) {
      for (const tr of msg.toolRequests) {
        tools.add(tr.name);
      }
    }
  }
  return [...tools].sort();
}

export function buildTurnOptions(messages: ParsedMessage[]): TurnOption[] {
  const turns: TurnOption[] = [];
  let currentTurnId: string | null = null;
  let currentTurnMessages: ParsedMessage[] = [];
  let currentTurnLabel = '';

  function flushTurn() {
    if (currentTurnMessages.length > 0 && currentTurnId) {
      turns.push({
        turnId: currentTurnId,
        label: currentTurnLabel || `Turn ${turns.length + 1}`,
        messages: currentTurnMessages,
      });
    }
    currentTurnMessages = [];
    currentTurnLabel = '';
    currentTurnId = null;
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      flushTurn();
      currentTurnId = msg.interactionId ?? msg.id;
      const preview = msg.content.trim().slice(0, 60) || 'Empty message';
      currentTurnLabel = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;
      currentTurnMessages.push(msg);
    } else {
      if (currentTurnId) {
        currentTurnMessages.push(msg);
      } else {
        currentTurnId = msg.interactionId ?? msg.id;
        const preview = msg.content.trim().slice(0, 60) || 'Empty message';
        currentTurnLabel = preview.length > 60 ? `${preview.slice(0, 59)}…` : preview;
        currentTurnMessages.push(msg);
      }
    }
  }
  flushTurn();
  return turns;
}

function matchesTimeWindow(timestamp: string, window: MessageFilterState['timeWindow']): boolean {
  if (window === 'all') return true;
  const msgTime = Date.parse(timestamp);
  if (Number.isNaN(msgTime)) return true;
  const now = Date.now();
  const diffMs = now - msgTime;
  const limits: Record<Exclude<MessageFilterState['timeWindow'], 'all'>, number> = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };
  return diffMs <= limits[window];
}

function messageHasError(msg: ParsedMessage): boolean {
  if (msg.role === 'assistant' && msg.toolRequests) {
    return msg.toolRequests.some((tr) => !!tr.error);
  }
  return false;
}

function messageHasToolCall(msg: ParsedMessage): boolean {
  return msg.role === 'assistant' && !!msg.toolRequests && msg.toolRequests.length > 0;
}

function messageHasReasoning(msg: ParsedMessage): boolean {
  return msg.role === 'assistant' && !!msg.reasoning && msg.reasoning.trim().length > 0;
}

function messageMatchesTools(msg: ParsedMessage, tools: string[]): boolean {
  if (tools.length === 0) return true;
  if (msg.role !== 'assistant' || !msg.toolRequests) return false;
  const msgTools = new Set(msg.toolRequests.map((tr) => tr.name));
  return tools.some((t) => msgTools.has(t));
}

export function applyMessageFilters(
  messages: ParsedMessage[],
  filters: MessageFilterState,
  turnOptions: TurnOption[],
): ParsedMessage[] {
  let result = messages;
  if (filters.turnId) {
    const turn = turnOptions.find((t) => t.turnId === filters.turnId);
    if (turn) {
      result = turn.messages;
    }
  }

  return result.filter((msg) => {
    if (filters.participants.length > 0 && !filters.participants.includes(msg.role)) {
      return false;
    }

    if (!matchesTimeWindow(msg.timestamp, filters.timeWindow)) {
      return false;
    }

    if (filters.hasToolCall && !messageHasToolCall(msg)) {
      return false;
    }

    if (filters.hasReasoning && !messageHasReasoning(msg)) {
      return false;
    }

    if (filters.hasError && !messageHasError(msg)) {
      return false;
    }

    if (filters.tools.length > 0 && !messageMatchesTools(msg, filters.tools)) {
      return false;
    }

    return true;
  });
}

export function isFilterActive(filters: MessageFilterState): boolean {
  return (
    filters.participants.length > 0 ||
    filters.tools.length > 0 ||
    filters.hasToolCall ||
    filters.hasReasoning ||
    filters.hasError ||
    filters.timeWindow !== 'all' ||
    filters.turnId !== null
  );
}

export function formatTimeWindowLabel(window: MessageFilterState['timeWindow']): string {
  const labels: Record<MessageFilterState['timeWindow'], string> = {
    '30m': 'Last 30 minutes',
    '1h': 'Last 1 hour',
    '6h': 'Last 6 hours',
    '24h': 'Last 24 hours',
    'all': 'All time',
  };
  return labels[window];
}
