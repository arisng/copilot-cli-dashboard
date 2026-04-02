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

## Styling

- All `gh-*` color tokens defined in `tailwind.config.ts`.
- Font: JetBrains Mono (self-hosted in `public/fonts/`, declared in `globals.css`).
- Body and `font-mono` both use JetBrains Mono.
