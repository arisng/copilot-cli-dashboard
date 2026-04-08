---
date: 2026-04-08
type: Feature Plan
severity: High
status: Implemented
---

# Command Palette — Global Search Across Sessions

## Goal

Add a keyboard-driven command palette to the Copilot Sessions Dashboard that lets users search across all session data without navigating session by session. The first pilot scope is searching **Research files** stored in `~/.copilot/session-state/<session-id>/research/` across all sessions simultaneously.

The palette follows the familiar VS Code / Linear UX pattern: invoke with `Ctrl+K` (or `Cmd+K`), type to filter, arrow-key to navigate, `Enter` to act. This replaces slow, manual session-by-session browsing for users who need to rediscover research output or trigger quick navigation actions.

## Requirements

### Backend — Search API

- [ ] New endpoint `GET /api/search` accepting query params: `q` (search text), `type` (e.g. `research`, `files`, `all`)
- [ ] For `type=research` (pilot scope): scan `research/` directory of every session root returned by `getSessionRoots()`, read artifact metadata (file name, path, session ID, last-modified)
- [ ] Full-text search inside `.md` and `.txt` research files (filename match + content snippet extraction)
- [ ] Return results as `{ sessionId, sessionName, filePath, snippet, lastModified }[]`, capped at 50 results, sorted by `lastModified` descending
- [ ] Reuse `readSessionArtifacts` + existing `ALLOWED_ARTIFACT_PREFIXES` path-safety checks — no new path traversal surface
- [ ] Keep response under 200 ms for ≤ 20 sessions; do not block the event loop (use async file I/O)

### Frontend — Command Palette Component

- [ ] New `CommandPalette.tsx` component under `client/src/components/shared/`
- [ ] Triggered globally by `Ctrl+K` / `Cmd+K` keyboard shortcut registered in `App.tsx`
- [ ] Modal overlay with search input, result list, and keyboard navigation (`↑` / `↓` / `Enter` / `Escape`)
- [ ] Debounced API call to `GET /api/search?q=<query>&type=research` (300 ms debounce)
- [ ] Each result row shows: session name, research file name, last-modified (relative), and a one-line content snippet
- [ ] `Enter` on a result navigates to the session's Artifacts tab and scrolls to / opens the file (reuse existing `SessionArtifacts` deep-link pattern)
- [ ] Empty state when `q` is blank: show recent research files (last 10 by `lastModified`)
- [ ] Loading spinner while fetching; error state if API call fails

### UX / Accessibility

- [ ] Focus trap inside the modal; `Escape` dismisses and returns focus to the previously focused element
- [ ] `aria-live` region announces result count to screen readers
- [ ] Respects `prefers-reduced-motion` — skip open/close animation when set
- [ ] Works on desktop and mobile layouts (full-screen on mobile, centered modal on desktop)
- [ ] Keyboard shortcut does not interfere with input fields (`preventDefault` only when no input is focused)

### Extensibility (post-pilot)

- [ ] `type=all` search scope that fans out to sessions, files, todos, and messages
- [ ] Quick-action commands (e.g., "Open session X", "Copy session ID", "Go to needs-attention sessions") registered alongside search results
- [ ] Configurable shortcut key via `appsettings` or URL param

## Proposed Implementation

### New API endpoint

```
server/src/router.ts       — add GET /api/search route
server/src/sessionReader.ts — add searchResearchArtifacts(q, sessionRoots) helper
```

`searchResearchArtifacts` should:
1. Call `getSessionRoots()` (already cached with 30-second TTL).
2. For each root, iterate `<root>/<sessionId>/research/` using `fs.promises.readdir`.
3. Match filenames against `q` (case-insensitive substring); for `.md`/`.txt` files also do a line-scan for the first matching line to use as `snippet`.
4. Validate each resolved path against `ALLOWED_ARTIFACT_PREFIXES` and the session root before reading content.

### New frontend component

```
client/src/components/shared/CommandPalette/
  CommandPalette.tsx        — modal shell, keyboard listener, state
  CommandPaletteResult.tsx  — single result row
  useCommandPalette.ts      — open/close state + shortcut registration hook
  index.ts                  — barrel re-export
```

Mount `<CommandPalette />` once in `App.tsx` alongside the router, so it is available on any route.

### API client

Extend `client/src/api/client.ts` with a `searchResearch(q: string)` function:

```ts
export async function searchResearch(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=research`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}
```

### Types

Add `SearchResult` to `server/src/sessionTypes.ts` and expose via the API response shape.

## Risks & Considerations

- **Performance on large session counts**: reading many research directories synchronously could block. Mitigate with `Promise.all` + a concurrency limiter (e.g., `p-limit` or a simple semaphore with batch size 10).
- **Content size**: avoid reading large binary research files; skip non-text extensions and cap read to first 50 KB per file.
- **Privacy**: research files may contain sensitive content. The API is already localhost-only; no additional auth needed for the pilot, but note this if remote-access tunneling is enabled.
- **Keyboard shortcut conflict**: `Ctrl+K` is used by some browsers / OS features — test on Windows, macOS, Linux and on mobile (where the shortcut is irrelevant).
- **Mobile UX**: on mobile, expose the palette via a floating search button in `MobileLayout.tsx` instead of the keyboard shortcut.
- **Stale results**: research files can be written while the dashboard is open. Use the same `ROOT_DISCOVERY_TTL_MS` caching strategy for session roots; accept up to 30-second staleness for the pilot.
