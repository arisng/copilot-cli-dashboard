# Client Architecture

React 18 + Vite + TypeScript + Tailwind CSS.

## Structure

```
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

## Multi-Session Watch Mode

The **Watch Mode** (`/watch?ids=...`) enables users to monitor multiple sessions side-by-side on desktop.

### Key Features

- **Viewport-based pane sizing**: Panes are sized based on available width (`MIN_PANE_WIDTH = 360px`, max 4 panes).
- **Horizontal scrolling**: Overflow sessions scroll horizontally without breaking layout.
- **Independent polling**: Each pane uses its own `useSession` hook for live updates.
- **Pane removal**: Each pane has a × button to remove it from the watch view.

### Mobile Session Pane Reuse

The watch mode reuses the mobile session layout rather than creating a new desktop shell:

```tsx
// MobileSessionPane.tsx exports two variants:

// 1. Data-fetching wrapper (used in mobile routes)
export function MobileSessionPane({ sessionId, showBackLinks }) {
  const { session, loading, error } = useSession(sessionId);
  // ...
  return <MobileSessionPaneInner session={session} ... />;
}

// 2. Presentation-only component (used in watch mode)
export function MobileSessionPaneInner({ session, showBackLinks, error }) {
  // Full mobile UI: header, status, tabs (overview, activity, work, agents)
}
```

This pattern ensures:
- **Consistency**: Mobile and watch mode show identical session content.
- **Live updates**: Each pane independently polls every 5 seconds.
- **Isolation**: Tab state (active section, selected stream) is per-pane.

### Bulk Selection Flow

1. User checks sessions in `SessionList` (list or grid view).
2. "Watch selected" button appears in header.
3. Clicking navigates to `/watch?ids=id1,id2,id3`.
4. `SessionWatchMode` parses IDs and renders a pane for each.

## Markdown Rendering

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

### Supported Features

| Feature | Desktop | Mobile | Message |
|---------|---------|--------|---------|
| Headings (H1-H6) | ✅ | ✅ | ✅ |
| Paragraphs | ✅ | ✅ | ✅ |
| Bold, Italic, Strikethrough | ✅ | ✅ | ✅ |
| Inline code | ✅ | ✅ | ✅ |
| Fenced code blocks | ✅ + syntax highlight | ✅ + syntax highlight | ✅ + syntax highlight |
| Unordered lists | ✅ | ✅ | ✅ |
| Ordered lists | ✅ | ✅ | ✅ |
| Nested lists (mixed) | ✅ | ✅ | ✅ |
| Task lists (`- [ ]`) | ✅ | ✅ | ✅ |
| Tables | ✅ | ✅ | ✅ |
| Blockquotes | ✅ | ✅ | ✅ |
| Horizontal rules | ✅ | ✅ | ✅ |
| Links (external) | ✅ (new tab) | ✅ (new tab) | ✅ (new tab) |
| XML-like tags | ✅ (preserved) | ✅ (preserved) | ✅ (preserved) |

### Security

- Content is sanitized to remove `<script>` tags and `javascript:` URLs
- External links open in new tab with `rel="noopener noreferrer nofollow"`
- XML-like tags (e.g., `<history>`, `<analysis>`) are preserved as text

### Known Limitations

- Very large documents (>2MB) may impact performance
- Tables on mobile require horizontal scrolling for wide content
- Code blocks don't have line numbers

## Workflow Topology View

`WorkflowTopologyView.tsx` renders a turn-by-turn orchestration graph for a selected session turn. The pipeline has two phases.

### Phase 1 — `buildMultiTurnGraph(messages)`

Builds raw `WorkflowRound[]` from `ParsedMessage[]`. Each assistant turn with tool requests becomes a round containing:
- A `type: 'main-agent'` orchestrator node.
- One response node per tool request:
  - `task` / `read_agent` → `type: 'tool-call'` with `metadata.dispatch.family = 'agent-management'` and `metadata.backgroundMode = (args.mode === 'background')`.
  - `shell` with `detached: true` → `type: 'detached-shell'`.
  - `task_complete`, `exit_plan_mode` → `type: 'main-agent'` (orchestration, not a separate worker).
  - Everything else → `type: 'tool-call'`.

### Phase 2 — Enrichment (useMemo)

After Phase 1, the `activeSubAgents` array from the server is indexed by `toolCallId`. Each Phase 1 `tool-call` node whose `metadata.toolCallId` matches an `ActiveSubAgent` entry is **upgraded in-place** to `type: 'sub-agent'` with server-side lifecycle data (label, model, status). The `backgroundMode` flag stored in Phase 1 metadata drives `metadata.backgroundInfo.detached` in Phase 2, which controls the "BACKGROUND TASK" badge.

### Node Type → Badge / Color

| `type` | `backgroundInfo.detached` | Badge | Border color |
|--------|--------------------------|-------|--------------|
| `user-prompt` | — | — | `gh-accent` blue |
| `main-agent` | — | ORCHESTRATOR | purple |
| `tool-call` | — | TOOL CALL | `gh-muted` grey (indigo for `agent-management`) |
| `sub-agent` | `false` | SUB AGENT | sky-400 |
| `sub-agent` | `true` | BACKGROUND TASK | sky-500 (brighter) |
| `detached-shell` | — | DETACHED SHELL | amber |
| `result` | — | — | `gh-active` green |

### Filter Behavior

`applyNodeFilter(enrichedRounds, ...)` is called on the enriched output. Core nodes (`user-prompt`, `main-agent`, `result`) are never hidden.

| Filter | Hidden types |
|--------|-------------|
| `agents-only` | `tool-call` |
| `tools-only` | `sub-agent`, `detached-shell` |

Additional `agentTypes` and `dispatchFamilies` filters use normalized taxonomy fields from node metadata.

### Model Provenance

Inferred models (source `'inferred'`) are shown with a `~` prefix and lighter colour. Authoritative models (source `'dispatch-override'` or `'custom-agent-default'`) are shown without the prefix.

## MessageBubble Tool Rendering

Specialised components for known tool types — fall back to generic `ToolCallBlock`:

| Tool | Component | Key fields |
|------|-----------|------------|
| `ask_user` | `AskUserBlock` | `message`/`question`, `requestedSchema`/`choices` |
| `edit` | `EditBlock` | `path`, `old_str`, `new_str` |
| `bash` | `BashBlock` | `command`, `description`, `mode` |
| everything else | `ToolCallBlock` | generic JSON input + output |

`ask_user` handles two argument schemas:
- Old: `{ question, choices[], allow_freeform }`
- New: `{ message, requestedSchema: { properties: { field: { enum[] } } } }`

Result content is prefixed `"User selected: "` or `"User responded: "` — strip before comparing against choices.

## Notifications

- Permission prompt in `Layout` header (always visible regardless of route).
- `useSessionNotifications` runs in `Layout` so it fires on any route.
- Detects transitions: `needsAttention false→true` and `isTaskComplete false→true`.
- Tags include `Date.now()` suffix to bypass browser deduplication.

## Artifact File Browser

The Session Detail view includes a file browser for viewing session artifacts in the `files/`, `checkpoints/`, and `research/` folders.

### Supported File Types

| Type | Extensions | Behavior |
|------|------------|----------|
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico` | Inline preview with download option |
| **Markdown** | `.md`, `.markdown`, `.mdown` | Rendered with `MarkdownRenderer` |
| **Text** | any other | Displayed as plain text |

### Image Preview

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
- **Loading state**: Shows spinner while image loads
- **Error handling**: Displays error message with retry and download buttons
- **Responsive**: Images are constrained to container width (`max-width: 100%`)
- **Download**: Download link available for all images

### API Endpoint

Raw file content is served via:

```
GET /api/sessions/:sessionId/artifacts/file?path={filePath}
```

- Returns file with appropriate `Content-Type` header
- Path traversal attempts are blocked (403 response)
- Only files within `files/`, `checkpoints/`, `research/` folders are accessible

## Styling

- All `gh-*` color tokens defined in `tailwind.config.ts`.
- Font: JetBrains Mono (self-hosted in `public/fonts/`, declared in `globals.css`).
- Body and `font-mono` both use JetBrains Mono.
