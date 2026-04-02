import type { TodoItem } from '../api/client.ts';

export function sortTodosLatestFirst(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((left, right) => {
    const leftCreated = Date.parse(left.createdAt);
    const rightCreated = Date.parse(right.createdAt);
    if (leftCreated !== rightCreated) {
      return rightCreated - leftCreated;
    }

    const leftUpdated = Date.parse(left.updatedAt);
    const rightUpdated = Date.parse(right.updatedAt);
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }

    // Stable fallback: use id lexicographically descending to preserve a
    // deterministic order when timestamps are identical.
    return right.id.localeCompare(left.id);
  });
}
