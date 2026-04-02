# Todo Sorting Design

The dashboard renders todo items in reverse chronological order (newest first) in both the desktop **Todos** tab and the mobile **Work** panel. This document explains why the sorting is implemented at the presentation layer and how it stays stable across different data sources.

## Why sort in the client

Todos can arrive from two places:

1. The server's `readTodos` helper, which queries `session.db`.
2. The client's `buildTodoItemsFromDb` fallback, which inspects the same database tables on demand.

Both sources currently return rows in ascending creation order. Rather than changing the server query (and the fallback query) to `ORDER BY created_at DESC`, the dashboard applies a single `sortTodosLatestFirst` utility in the React components that render the list.

**Benefits of this approach:**

- **View independence** — The server and session-reader remain source-of-truth neutral. Other consumers can still receive chronological order if they need it.
- **Consistent behavior** — Both desktop and mobile views share the same sort logic, so reordering bugs are fixed in one place.
- **Stable tie-breaking** — The utility uses `createdAt`, then `updatedAt`, then `id` as tiebreakers. This guarantees a deterministic order even when multiple todos share the same timestamp.

## Sort implementation

`client/src/utils/todoSort.ts` performs a shallow copy and sorts with `Date.parse`:

```ts
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

    return right.id.localeCompare(left.id);
  });
}
```

The function is pure: it never mutates the input array, making it safe to use inside React renders and `useMemo` hooks.

## Testing strategy

Because the project had no existing test framework, `vitest` was added to the client workspace. The sort utility is covered by unit tests in `client/src/utils/todoSort.test.ts` that verify:

- Basic chronological reversal
- Tie-breaking with identical `createdAt` values
- Tie-breaking with identical timestamps
- Empty and single-item arrays

## Lessons learned

- **Presentation-layer sorts are cheap and flexible.** For small collections like a session's todos, client-side sorting is negligible in performance and avoids coupling display preferences to the data layer.
- **Always return a new array.** Sorting in place can trigger subtle React re-render issues; `[...todos].sort(...)` is a simple safeguard.
- **Add tests for edge cases upfront.** Todos created in rapid succession often share timestamps, so stable tie-breaking should be verified from the start.
