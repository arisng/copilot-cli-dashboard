# Client Architecture Reference

React 18 + Vite + TypeScript + Tailwind CSS powers the dashboard UI.

## Overview

The client is a single-page application that polls the API for session data and renders session list and detail views.

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

## Message bubble tool rendering

Specialised components render known tool types, with a generic `ToolCallBlock` fallback.

| Tool | Component | Key fields |
|------|-----------|------------|
| `ask_user` | `AskUserBlock` | `message`/`question`, `requestedSchema`/`choices` |
| `edit` | `EditBlock` | `path`, `old_str`, `new_str` |
| `bash` | `BashBlock` | `command`, `description`, `mode` |
| everything else | `ToolCallBlock` | generic JSON input + output |

`ask_user` supports two argument schemas:

- Old: `{ question, choices[], allow_freeform }`
- New: `{ message, requestedSchema: { properties: { field: { enum[] } } } }`

Result content is prefixed with `User selected: ` or `User responded: `.

## Notifications

- Permission prompt lives in the `Layout` header.
- `useSessionNotifications` runs in `Layout` so it works on every route.
- Notifications trigger on `needsAttention false→true` and `isTaskComplete false→true`.
- Tag identifiers include a `Date.now()` suffix so browser deduplication does not hide repeated alerts.

## Styling

- All `gh-*` color tokens are defined in `tailwind.config.ts`.
- JetBrains Mono is self-hosted in `public/fonts/` and declared in `globals.css`.
- The body and `font-mono` both use JetBrains Mono.

## Related references

- [Server Architecture Reference](../server/server-architecture.md)
- [Session Data Model Reference](../session-state/session-data-model.md)

