# Client Architecture Reference

React 18 + Vite + TypeScript + Tailwind CSS powers the dashboard UI.

## Overview

The client is a single-page application that polls the API for session data and renders session list, detail, and multi-session watch views.

## Structure

```text
client/src/
├── api/client.ts               # fetch wrappers + shared TypeScript types
├── hooks/
│   ├── useSessions.ts          # polls /api/sessions every 5 s
│   ├── useSession.ts           # polls /api/sessions/:id every 5 s
│   └── useNotifications.ts     # Notifications API + state-change detection
├── components/
│   ├── shared/
│   │   ├── Layout.tsx          # nav bar, server-down banner, notification button
│   │   ├── RelativeTime.tsx    # "3m ago" display
│   │   ├── LoadingSpinner.tsx
│   │   └── MarkdownRenderer/   # shared markdown rendering component
│   │       ├── MarkdownRenderer.tsx
│   │       └── __fixtures__/   # test fixtures for complex markdown
│   ├── SessionList/
│   │   ├── SessionList.tsx     # table of active (isOpen) sessions
│   │   ├── SessionRow.tsx      # single row with status badge + copy-branch
│   │   └── AttentionBadge.tsx
│   ├── SessionDetail/
│   │   ├── SessionDetail.tsx   # message thread, auto-scrolls to bottom
│   │   ├── SessionMeta.tsx     # title, status badges, meta bar
│   │   └── MessageBubble.tsx   # renders user/assistant/task_complete messages
│   ├── SessionWatchMode/       # Multi-session watch mode
│   │   ├── SessionWatchMode.tsx # side-by-side session panes
│   │   └── SessionWatchPane.tsx # single pane with close control
│   └── mobile/                 # Mobile-optimized views
│       ├── MobileSessionList.tsx
│       ├── MobileSessionDetail.tsx
│       └── MobileSessionPane.tsx # Reusable mobile session UI
└── styles/globals.css          # @font-face (JetBrains Mono) + scrollbar styles
```

## Multi-session watch mode

The Watch Mode (`/watch?ids=...`) enables monitoring multiple sessions side-by-side on desktop.

### Key features

- **Viewport-based pane sizing**: panes are sized based on available width (`MIN_PANE_WIDTH = 360px`, max 4 panes).
- **Horizontal scrolling**: overflow sessions scroll horizontally without breaking layout.
- **Independent polling**: each pane uses its own `useSession` hook for live updates.
- **Pane removal**: each pane has a × button to remove it from the watch view.

### Mobile session pane reuse

The watch mode reuses the mobile session layout rather than creating a new desktop shell:

```tsx
// MobileSessionPane.tsx exports two variants:

// 1. Data-fetching wrapper (used in mobile routes)
export function MobileSessionPane({ sessionId, showBackLinks }) {
  const { session, loading, error } = useSession(sessionId);
  return <MobileSessionPaneInner session={session} ... />;
}

// 2. Presentation-only component (used in watch mode)
export function MobileSessionPaneInner({ session, showBackLinks, error }) {
  // Full mobile UI: header, status, tabs (overview, activity, work, agents)
}
```

This ensures:

- **Consistency**: mobile and watch mode show identical session content.
- **Live updates**: each pane independently polls every 5 seconds.
- **Isolation**: tab state (active section, selected stream) is per-pane.

### Bulk selection flow

1. User checks sessions in `SessionList` (list or grid view).
2. "Watch selected" button appears in header.
3. Clicking navigates to `/watch?ids=id1,id2,id3`.
4. `SessionWatchMode` parses IDs and renders a pane for each.

## Markdown rendering

The `MarkdownRenderer` component provides consistent markdown rendering across desktop, mobile, and message surfaces.

### Usage

```tsx
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

// Desktop variant (default)
<MarkdownRenderer content={planContent} variant="desktop" />

// Mobile variant
<MarkdownRenderer content={planContent} variant="mobile" />

// Message bubble variant
<MarkdownRenderer content={messageContent} variant="message" />
```

### Supported features

| Feature                     | Desktop              | Mobile               | Message              |
| --------------------------- | -------------------- | -------------------- | -------------------- |
| Headings (H1–H6)            | ✅                    | ✅                    | ✅                    |
| Paragraphs                  | ✅                    | ✅                    | ✅                    |
| Bold, italic, strikethrough | ✅                    | ✅                    | ✅                    |
| Inline code                 | ✅                    | ✅                    | ✅                    |
| Fenced code blocks          | ✅ + syntax highlight | ✅ + syntax highlight | ✅ + syntax highlight |
| Unordered lists             | ✅                    | ✅                    | ✅                    |
| Ordered lists               | ✅                    | ✅                    | ✅                    |
| Nested lists (mixed)        | ✅                    | ✅                    | ✅                    |
| Task lists (`- [ ]`)        | ✅                    | ✅                    | ✅                    |
| Tables                      | ✅                    | ✅                    | ✅                    |
| Blockquotes                 | ✅                    | ✅                    | ✅                    |
| Horizontal rules            | ✅                    | ✅                    | ✅                    |
| Links (external)            | ✅ (new tab)          | ✅ (new tab)          | ✅ (new tab)          |
| XML-like tags               | ✅ (preserved)        | ✅ (preserved)        | ✅ (preserved)        |

### Security

- Content is sanitized to remove `<script>` tags and `javascript:` URLs.
- External links open in a new tab with `rel="noopener noreferrer nofollow"`.
- XML-like tags (e.g., `<history>`, `<analysis>`) are preserved as text.

### Known limitations

- Very large documents (>2 MB) may impact performance.
- Tables on mobile require horizontal scrolling for wide content.
- Code blocks do not have line numbers.

## Workflow topology view

The topology graph renders a turn-by-turn orchestration view for a selected session. See the dedicated reference:

→ [Workflow Topology Reference](workflow-topology.md)

## Message bubble tool rendering

Specialised components render known tool types, with a generic `ToolCallBlock` fallback:

| Tool            | Component       | Key fields                                        |
| --------------- | --------------- | ------------------------------------------------- |
| `ask_user`      | `AskUserBlock`  | `message`/`question`, `requestedSchema`/`choices` |
| `edit`          | `EditBlock`     | `path`, `old_str`, `new_str`                      |
| `bash`          | `BashBlock`     | `command`, `description`, `mode`                  |
| everything else | `ToolCallBlock` | generic JSON input + output                       |

`ask_user` handles two argument schemas:

- Old: `{ question, choices[], allow_freeform }`
- New: `{ message, requestedSchema: { properties: { field: { enum[] } } } }`

Result content is prefixed `"User selected: "` or `"User responded: "` — strip before comparing against choices.

## Artifact file browser

The Session Detail view includes a file browser for viewing session artifacts in the `files/`, `checkpoints/`, and `research/` folders.

### Supported file types

| Type         | Extensions                                                       | Behavior                            |
| ------------ | ---------------------------------------------------------------- | ----------------------------------- |
| **Images**   | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico` | Inline preview with download option |
| **Markdown** | `.md`, `.markdown`, `.mdown`                                     | Rendered with `MarkdownRenderer`    |
| **Text**     | any other                                                        | Displayed as plain text             |

### Image preview

Image files are detected by extension and rendered inline using the `ImagePreview` component:

```tsx
// Image files show a preview badge in the file list
<span className="text-gh-accent">image</span>

// Selecting an image displays inline preview
<ImagePreview
  sessionId={sessionId}
  filePath={entry.path}
  fileName={entry.name}
  fileSizeBytes={entry.sizeBytes}
/>
```

**Features:**

- **Loading state**: shows spinner while image loads
- **Error handling**: displays error message with retry and download buttons
- **Responsive**: images are constrained to container width (`max-width: 100%`)
- **Download**: download link available for all images

### API endpoint

Raw file content is served via:

```
GET /api/sessions/:sessionId/artifacts/file?path={filePath}
```

- Returns file with appropriate `Content-Type` header.
- Path traversal attempts are blocked (403 response).
- Only files within `files/`, `checkpoints/`, `research/` folders are accessible.

## Notifications

- Permission prompt lives in the `Layout` header (always visible regardless of route).
- `useSessionNotifications` runs in `Layout` so it fires on any route.
- Notifications trigger on `needsAttention false→true` and `isTaskComplete false→true`.
- Tags include a `Date.now()` suffix to bypass browser deduplication.

## Styling

- All `gh-*` color tokens are defined in `tailwind.config.ts`.
- JetBrains Mono is self-hosted in `public/fonts/` and declared in `globals.css`.
- Body and `font-mono` both use JetBrains Mono.

## Session Detail inspector

Desktop Session Detail is rail-first in column 2: the tab rail is the primary navigation, and the content panel stays scrollable so long views can be read without losing the rail.

The rail supports the core session views:

- Main session
- Plan
- Todos
- Sub-agent threads
- Checkpoints
- Research
- Session DB

Sub-agent threads are grouped so large sessions do not turn the rail into an unbounded list. The grouped view keeps the rail readable while still allowing explicit selection of an individual thread when needed.

The Plan tab is the single source of truth for `plan.md`; it is no longer duplicated inside the artifact explorer. Checkpoints and Research now have their own dedicated tabs, and each tab can open a file and show its full content rather than only metadata.

The Session DB surface uses the read-only `/api/sessions/:id/session-db` route and supports a toggle between table preview and the todo dependency graph presentation.

The client API exposes the supporting fetch helpers:

- `fetchSessionArtifacts(id)` for the artifact folder view
- `fetchSessionDb(id, table?, limit?)` for the SQLite inspector

## Related references

- [Server Architecture Reference](../server/server-architecture.md)
- [Session Data Model Reference](../session-state/session-data-model.md)
- [Workflow Topology Reference](workflow-topology.md)
- [Session Filtering Reference](session-filtering.md)
