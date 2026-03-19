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
│   │   └── LoadingSpinner.tsx
│   ├── SessionList/
│   │   ├── SessionList.tsx     # table of active (isOpen) sessions
│   │   ├── SessionRow.tsx      # single row with status badge + copy-branch
│   │   └── AttentionBadge.tsx
│   └── SessionDetail/
│       ├── SessionDetail.tsx   # message thread, auto-scrolls to bottom
│       ├── SessionMeta.tsx     # title, status badges, meta bar
│       └── MessageBubble.tsx   # renders user/assistant/task_complete messages
└── styles/globals.css          # @font-face (JetBrains Mono) + scrollbar styles
```

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
