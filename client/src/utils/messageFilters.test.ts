import { describe, it, expect } from 'vitest';
import type { ParsedMessage } from '../api/client.ts';
import {
  getMessageTools,
  buildTurnOptions,
  applyMessageFilters,
  isFilterActive,
  formatTimeWindowLabel,
  DEFAULT_MESSAGE_FILTER_STATE,
} from './messageFilters.ts';

function makeMsg(overrides: Partial<ParsedMessage> & { role: ParsedMessage['role'] }): ParsedMessage {
  return {
    id: 'msg-1',
    content: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  } as ParsedMessage;
}

describe('getMessageTools', () => {
  it('returns empty array for no messages', () => {
    expect(getMessageTools([])).toEqual([]);
  });

  it('extracts distinct tool names from assistant messages', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ role: 'assistant', toolRequests: [{ toolCallId: '1', name: 'bash', arguments: {}, type: 'tool' }] }),
      makeMsg({ role: 'assistant', toolRequests: [{ toolCallId: '2', name: 'edit', arguments: {}, type: 'tool' }] }),
      makeMsg({ role: 'assistant', toolRequests: [{ toolCallId: '3', name: 'bash', arguments: {}, type: 'tool' }] }),
    ];
    expect(getMessageTools(messages)).toEqual(['bash', 'edit']);
  });

  it('ignores user and task_complete messages', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ role: 'user' }),
      makeMsg({ role: 'task_complete', toolRequests: [{ toolCallId: '1', name: 'bash', arguments: {}, type: 'tool' }] }),
    ];
    expect(getMessageTools(messages)).toEqual([]);
  });
});

describe('buildTurnOptions', () => {
  it('returns empty array for no messages', () => {
    expect(buildTurnOptions([])).toEqual([]);
  });

  it('groups messages by user turns with interactionId fallback', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Hello', interactionId: 'turn-a' }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Hi', interactionId: 'turn-a' }),
      makeMsg({ id: 'u2', role: 'user', content: 'Bye', interactionId: 'turn-b' }),
      makeMsg({ id: 'a2', role: 'assistant', content: 'See ya', interactionId: 'turn-b' }),
    ];
    const turns = buildTurnOptions(messages);
    expect(turns).toHaveLength(2);
    expect(turns[0].turnId).toBe('turn-a');
    expect(turns[0].messages).toHaveLength(2);
    expect(turns[1].turnId).toBe('turn-b');
    expect(turns[1].messages).toHaveLength(2);
  });

  it('falls back to message id when interactionId is absent', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Hello' }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Hi' }),
    ];
    const turns = buildTurnOptions(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].turnId).toBe('u1');
    expect(turns[0].messages).toHaveLength(2);
  });

  it('includes task_complete in the preceding turn', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Do it' }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Done' }),
      makeMsg({ id: 'tc1', role: 'task_complete', content: 'Summary' }),
    ];
    const turns = buildTurnOptions(messages);
    expect(turns).toHaveLength(1);
    expect(turns[0].messages).toHaveLength(3);
  });

  it('handles orphan assistant messages before any user message', () => {
    const messages: ParsedMessage[] = [
      makeMsg({ id: 'a1', role: 'assistant', content: 'System' }),
      makeMsg({ id: 'u1', role: 'user', content: 'Hello' }),
    ];
    const turns = buildTurnOptions(messages);
    expect(turns).toHaveLength(2);
    expect(turns[0].turnId).toBe('a1');
    expect(turns[0].messages).toHaveLength(1);
    expect(turns[1].turnId).toBe('u1');
  });
});

describe('applyMessageFilters', () => {
  const baseMessages: ParsedMessage[] = [
    makeMsg({ id: 'u1', role: 'user', content: 'Hello', timestamp: new Date(Date.now() - 1000).toISOString() }),
    makeMsg({
      id: 'a1',
      role: 'assistant',
      content: 'Hi',
      timestamp: new Date(Date.now() - 900).toISOString(),
      reasoning: 'Think',
      toolRequests: [{ toolCallId: '1', name: 'bash', arguments: {}, type: 'tool' }],
    }),
    makeMsg({ id: 'u2', role: 'user', content: 'Fix', timestamp: new Date(Date.now() - 800).toISOString() }),
    makeMsg({
      id: 'a2',
      role: 'assistant',
      content: 'Oops',
      timestamp: new Date(Date.now() - 700).toISOString(),
      toolRequests: [{ toolCallId: '2', name: 'edit', arguments: {}, type: 'tool', error: { message: 'fail', code: 'x' } }],
    }),
    makeMsg({ id: 'tc1', role: 'task_complete', content: 'Done', timestamp: new Date(Date.now() - 600).toISOString() }),
  ];

  const turns = buildTurnOptions(baseMessages);

  it('returns all messages when filters are default', () => {
    const result = applyMessageFilters(baseMessages, DEFAULT_MESSAGE_FILTER_STATE, turns);
    expect(result).toHaveLength(baseMessages.length);
  });

  it('filters by turnId', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, turnId: turns[0].turnId }, turns);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('u1');
    expect(result[1].id).toBe('a1');
  });

  it('filters by participant multi-select', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, participants: ['user'] }, turns);
    expect(result.map((m) => m.role)).toEqual(['user', 'user']);
  });

  it('filters by time window', () => {
    const oldMsg = makeMsg({ id: 'old', role: 'user', content: 'Old', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() });
    const messages = [oldMsg, ...baseMessages];
    const result = applyMessageFilters(messages, { ...DEFAULT_MESSAGE_FILTER_STATE, timeWindow: '1h' }, buildTurnOptions(messages));
    expect(result.map((m) => m.id)).not.toContain('old');
  });

  it('filters by hasToolCall', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, hasToolCall: true }, turns);
    expect(result.map((m) => m.id)).toEqual(['a1', 'a2']);
  });

  it('filters by hasReasoning', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, hasReasoning: true }, turns);
    expect(result.map((m) => m.id)).toEqual(['a1']);
  });

  it('filters by hasError', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, hasError: true }, turns);
    expect(result.map((m) => m.id)).toEqual(['a2']);
  });

  it('filters by tool names', () => {
    const result = applyMessageFilters(baseMessages, { ...DEFAULT_MESSAGE_FILTER_STATE, tools: ['edit'] }, turns);
    expect(result.map((m) => m.id)).toEqual(['a2']);
  });

  it('composes turn filter with participant filter', () => {
    const result = applyMessageFilters(
      baseMessages,
      { ...DEFAULT_MESSAGE_FILTER_STATE, turnId: turns[0].turnId, participants: ['assistant'] },
      turns,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('composes turn filter with tool filter', () => {
    const result = applyMessageFilters(
      baseMessages,
      { ...DEFAULT_MESSAGE_FILTER_STATE, turnId: turns[1].turnId, tools: ['edit'] },
      turns,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a2');
  });
});

describe('isFilterActive', () => {
  it('returns false for default filters', () => {
    expect(isFilterActive(DEFAULT_MESSAGE_FILTER_STATE)).toBe(false);
  });

  it('returns true when any filter is set', () => {
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, participants: ['user'] })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, tools: ['bash'] })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, hasToolCall: true })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, hasReasoning: true })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, hasError: true })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, timeWindow: '30m' })).toBe(true);
    expect(isFilterActive({ ...DEFAULT_MESSAGE_FILTER_STATE, turnId: 'x' })).toBe(true);
  });
});

describe('formatTimeWindowLabel', () => {
  it('formats all windows correctly', () => {
    expect(formatTimeWindowLabel('all')).toBe('All time');
    expect(formatTimeWindowLabel('30m')).toBe('Last 30 minutes');
    expect(formatTimeWindowLabel('1h')).toBe('Last 1 hour');
    expect(formatTimeWindowLabel('6h')).toBe('Last 6 hours');
    expect(formatTimeWindowLabel('24h')).toBe('Last 24 hours');
  });
});
