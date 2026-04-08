---
description: Design decisions and architecture of the command palette feature.
---

# Command Palette Design

## Goals

The command palette was designed to solve a specific UX problem: users needed to find research output scattered across dozens of sessions without clicking through each session individually. The solution follows the familiar VS Code / Linear command palette pattern for immediate familiarity.

## Architecture

### Backend (Server)

The search is implemented as a stateless HTTP endpoint that:

1. **Discovers sessions** via `getSessionRoots()` (cached with 30-second TTL)
2. **Scans research directories** asynchronously with concurrency limiting (batch size 10)
3. **Matches files** by name (case-insensitive substring) and content (for text files ≤ 50 KB)
4. **Returns capped results** (max 50) sorted by `lastModified` descending

#### Concurrency Control

Session directories are scanned in batches to prevent blocking the event loop when many sessions exist:

```typescript
async function withConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<ResearchFileMatch[]>
): Promise<ResearchFileMatch[]>
```

#### Content Extraction

For matched text files, a snippet is extracted:

- If query matches content: context around the match (±75 chars)
- If only filename matches: first line of the file
- Snippets are truncated to ~150 chars with ellipsis indicators

### Frontend (Client)

The UI is composed of three layers:

1. **`useCommandPalette` hook** — manages open/close state, keyboard shortcut registration, and focus restoration
2. **`CommandPalette` component** — modal shell with debounced search, result list, and keyboard navigation
3. **`CommandPaletteResult` component** — individual result row with session name, file name, snippet, and timestamp

#### Keyboard Handling

The shortcut system is designed to avoid conflicts:

- `Ctrl+K` / `Cmd+K` opens the palette (prevents default to avoid browser conflicts)
- `Escape` closes the palette and restores previous focus
- `↑` / `↓` navigates the result list
- `Enter` selects the current result

The global shortcut is registered at the document level and works regardless of the currently focused element.

#### Debouncing

API calls are debounced by 300ms to avoid excessive requests while typing:

```typescript
useEffect(() => {
  const timeoutId = window.setTimeout(async () => {
    // API call
  }, DEBOUNCE_MS);
  return () => window.clearTimeout(timeoutId);
}, [query]);
```

#### Empty State

When the query is empty, the palette shows the 10 most recently modified research files. This provides immediate value without requiring a search term and serves as a "recently accessed" shortcut.

## Security Considerations

### Path Traversal Prevention

All resolved paths are validated before reading:

1. Check against `ALLOWED_ARTIFACT_PREFIXES` (`files/`, `checkpoints/`, `research/`, `plan.md`)
2. Reject paths containing `..` components
3. Verify resolved path is within the session directory

### Privacy

Research files may contain sensitive content. The API is restricted to localhost-only by default. Remote access via tunnels should be noted as a privacy consideration in deployment documentation.

## Performance Trade-offs

| Decision | Rationale |
|----------|-----------|
| Async file I/O | Prevents blocking the event loop during directory scans |
| Concurrency limit (10) | Balances parallelism with resource usage |
| 50 KB file size limit | Prevents memory issues with large binary files |
| 30-second root cache | Acceptable staleness for session discovery; keeps response fast |
| 300ms debounce | Balances responsiveness with API load |
| 50 result cap | Prevents UI overwhelm and keeps response payloads small |

## Accessibility

The implementation includes several accessibility features:

- **Focus trap**: Focus is contained within the modal while open
- **Focus restoration**: Returns to the previously focused element on close
- **ARIA live region**: Announces result count changes to screen readers
- **Keyboard navigation**: Full keyboard operability without mouse
- **Visual selection**: Clear highlighting of the currently selected result

## Future Extensibility

The design accommodates future expansion:

- **`type=all` parameter**: Reserved for searching sessions, files, todos, and messages
- **Quick actions**: Commands like "Go to needs-attention sessions" can be added alongside search results
- **Configurable shortcut**: The `useCommandPalette` hook accepts a customizable key combination
- **Mobile button**: A floating search button can be added to `MobileLayout.tsx` for touch access

## Lessons Learned

1. **Session root caching matters**: Without the 30-second TTL, repeated scans of the same directories caused noticeable latency.

2. **Snippet extraction is context-sensitive**: Users expect to see why a file matched. Showing the first line when only the filename matched was insufficient; context around content matches is more useful.

3. **Empty state is valuable**: The "recent files" behavior when query is empty gets frequent use and was worth the extra implementation effort.

4. **Concurrency limits prevent thundering herd**: Initial implementation scanned all sessions simultaneously, causing I/O contention with many sessions.
