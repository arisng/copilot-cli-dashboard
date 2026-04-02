import { describe, it, expect } from 'vitest';
import { sortTodosLatestFirst } from './todoSort.ts';
import type { TodoItem } from '../api/client.ts';

function makeTodo(overrides: Partial<TodoItem> & { id: string }): TodoItem {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Test todo',
    description: overrides.description ?? '',
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    dependsOn: overrides.dependsOn ?? [],
  };
}

describe('sortTodosLatestFirst', () => {
  it('returns a new array sorted by createdAt descending', () => {
    const todos: TodoItem[] = [
      makeTodo({ id: 'a', createdAt: '2026-01-01T10:00:00.000Z' }),
      makeTodo({ id: 'b', createdAt: '2026-01-01T12:00:00.000Z' }),
      makeTodo({ id: 'c', createdAt: '2026-01-01T08:00:00.000Z' }),
    ];

    const sorted = sortTodosLatestFirst(todos);

    expect(sorted.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(todos).toHaveLength(3); // original unchanged
  });

  it('falls back to updatedAt descending when createdAt is identical', () => {
    const todos: TodoItem[] = [
      makeTodo({ id: 'a', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }),
      makeTodo({ id: 'b', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T11:00:00.000Z' }),
      makeTodo({ id: 'c', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z' }),
    ];

    const sorted = sortTodosLatestFirst(todos);

    expect(sorted.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('falls back to id descending when both timestamps are identical', () => {
    const todos: TodoItem[] = [
      makeTodo({ id: 'alpha', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }),
      makeTodo({ id: 'beta', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }),
    ];

    const sorted = sortTodosLatestFirst(todos);

    expect(sorted.map((t) => t.id)).toEqual(['beta', 'alpha']);
  });

  it('places newest todo first for a mixed-age list', () => {
    const todos: TodoItem[] = [
      makeTodo({ id: 'oldest', createdAt: '2026-01-01T08:00:00.000Z' }),
      makeTodo({ id: 'middle', createdAt: '2026-01-01T10:00:00.000Z' }),
      makeTodo({ id: 'newest', createdAt: '2026-01-01T12:00:00.000Z' }),
    ];

    const sorted = sortTodosLatestFirst(todos);

    expect(sorted[0].id).toBe('newest');
    expect(sorted[sorted.length - 1].id).toBe('oldest');
  });

  it('handles an empty array', () => {
    expect(sortTodosLatestFirst([])).toEqual([]);
  });

  it('handles a single item', () => {
    const todo = makeTodo({ id: 'only' });
    expect(sortTodosLatestFirst([todo])).toEqual([todo]);
  });
});
