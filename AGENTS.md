# Copilot Sessions Dashboard

A local web dashboard that reads `~/.copilot/session-state/` and displays active Copilot CLI sessions in real time — with message history, tool call inspection, sub-agent orchestration, plan viewing, todo tracking, and browser notifications.

## Project Overview

This is a TypeScript monorepo with two workspaces:

- **`server/`** — Express API that reads Copilot session data from the filesystem
- **`client/`** — React 18 SPA that polls the API and renders the dashboard

The dashboard discovers and monitors GitHub Copilot CLI sessions by reading event logs directly from disk. No cloud APIs are used; all data stays local.

## Technology Stack

### Server
- **Runtime**: Node.js 18+ (ES modules)
- **Framework**: Express 4
- **Language**: TypeScript 5 with strict mode
- **Dev Tool**: `tsx watch` for hot-reload development
- **Key Dependencies**:
  - `better-sqlite3` — reads session.db for todo tracking
  - `cors` — cross-origin requests from Vite dev server
  - `js-yaml` — YAML parsing (if needed)

### Client
- **Framework**: React 18 with hooks
- **Build Tool**: Vite 5
- **Language**: TypeScript 5 with strict mode
- **Styling**: Tailwind CSS 3 with custom `gh-*` color tokens (GitHub-inspired dark theme)
- **Routing**: React Router 6
- **Key Dependencies**:
  - `react-markdown` + `remark-gfm` — renders plan.md content
  - `react-syntax-highlighter` — code blocks in messages
- **Font**: JetBrains Mono (self-hosted)

### Build System
- npm workspaces with lockfile v3
- `concurrently` for running server + client in dev
- Distribution via npm as `copiloting-agents` package

## Build and Development Commands

Run all commands from the **repo root**:

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies for all workspaces |
| `npm run dev` | Start both server (port 3001) and client (port 5173) concurrently |
| `npm run build` | Build server (`tsc`) and client (`vite build`) for production |
| `npm start` | Build + serve production build on http://localhost:3001 |

Individual workspace commands:

| Command | Description |
|---------|-------------|
| `npm run dev --workspace=server` | Server only (`tsx watch`, hot-reload) |
| `npm run dev --workspace=client` | Client only (Vite HMR on port 5173) |
| `npm run build --workspace=server` | Compile TypeScript to `server/dist/` |
| `npm run build --workspace=client` | Build static files to `client/dist/` |

Remote access via Dev Tunnels:

| Command | Description |
|---------|-------------|
| `npm run tunnel:client` | Expose Vite dev server (port 5173) via Dev Tunnels |
| `npm run tunnel:prod` | Expose production server (port 3001) via Dev Tunnels |

Global installation:

```bash
npx copiloting-agents
```

## Architecture

### Server Architecture

**Entry Point**: `server/src/index.ts`

- Express app with CORS and JSON middleware
- Routes mounted at `/api`
- Static file serving from `client/dist/` in production
- Port auto-fallback: if 3001 is in use and `PORT` is unset, tries next available port

**Router** (`server/src/router.ts`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/sessions` | All sessions (active + closed), sorted by last activity |
| GET | `/api/sessions/:id` | Full session detail including messages, plan, todos |

**Session Reader** (`server/src/sessionReader.ts`):

- Discovers session roots: `~/.copilot/session-state/` plus WSL distributions on Windows
- Override with `COPILOT_SESSION_STATE` environment variable (path-delimited)
- Parses `events.jsonl` (newline-delimited JSON) for each session
- Reads `session.db` SQLite for todo items
- Uses file signatures for caching; re-parses only when files change

**Session State Determination** (`server/src/utils/needsAttention.ts`):

- `isOpen`: true if `inuse.<pid>.lock` file exists (lock file is source of truth)
- `needsAttention`: pending `ask_user` or `exit_plan_mode` tool, or stuck non-bash tool > 1 min
- `isWorking`: open session with active assistant turn or autonomous pending work
- `isAborted`: last action after user message was `abort`
- `isTaskComplete`: last action was `session.task_complete`
- `isIdle`: turn ended cleanly, waiting for next user message

### Client Architecture

**Entry Point**: `client/src/main.tsx` → `App.tsx`

**Routes** (defined in `App.tsx`):

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `SessionList` | Desktop session list view |
| `/sessions/:id` | `SessionDetail` | Desktop session detail with tabs |
| `/m` | `MobileSessionList` | Mobile-optimized list view |
| `/m/sessions/:id` | `MobileSessionDetail` | Mobile-optimized detail view |

**Key Components**:

- `Layout` — nav bar, notification button, server-down banner, mobile switch prompt
- `SessionList` — list/grid toggle, filter/sort controls, session cards/rows
- `SessionDetail` — message thread with auto-scroll, tabbed sub-agent views
- `MessageBubble` — renders user/assistant/task_complete messages with tool call blocks
- `SessionTabNav` — tabs for Main, Plan, Todos, and each sub-agent thread

**Hooks**:

- `useSessions` — polls `/api/sessions` every 5 seconds with caching
- `useSession` — polls `/api/sessions/:id` every 5 seconds
- `useNotifications` — browser notification permission and state-change detection
- `useSessionBrowse` — URL-based filter/sort state management

**API Client** (`client/src/api/client.ts`):

- TypeScript interfaces matching server types (duplicated in client for independence)
- `fetchSessions()`, `fetchSession()`, `checkHealth()`

## Code Style Guidelines

### TypeScript
- Strict mode enabled in both workspaces — no `any` without explicit justification
- Prefer explicit return types on exported functions
- Use ES modules (`"type": "module"` in package.json)

### Styling
- **Tailwind only** — no CSS modules, no styled-components
- Use custom `gh-*` color tokens defined in `tailwind.config.ts`:
  - `gh-bg` (#0d1117) — page background
  - `gh-surface` (#161b22) — card/surface backgrounds
  - `gh-border` (#30363d) — borders
  - `gh-text` (#e6edf3) — primary text
  - `gh-muted` (#8b949e) — secondary text
  - `gh-accent` (#58a6ff) — links and accents
  - `gh-attention` (#f85149) — error/attention states
  - `gh-active` (#3fb950) — success/active states
  - `gh-warning` (#d29922) — warnings

### File Organization
```
client/src/
├── api/              # fetch wrappers and TypeScript types
├── hooks/            # React hooks for data fetching and state
├── components/
│   ├── shared/       # Layout, buttons, badges, utilities
│   ├── SessionList/  # List view components
│   ├── SessionDetail/# Detail view components
│   └── mobile/       # Mobile-optimized components
└── styles/           # global CSS, fonts

server/src/
├── index.ts          # Server entry
├── router.ts         # Express route handlers
├── sessionReader.ts  # Core session parsing logic
├── sessionTypes.ts   # TypeScript interfaces
└── utils/
    └── needsAttention.ts  # Status detection logic
```

## Key Conventions

### Session State Source of Truth
The lock file (`inuse.<pid>.lock`) determines `isOpen`. The absence of `session.shutdown` event is irrelevant — a session can have a shutdown event from a prior run and still be active if the lock file exists.

### No Server-Side Caching of Session Data
`listAllSessions()` and `parseSessionDir()` read the filesystem fresh on every API call (except for the in-memory signature cache that skips re-parsing unchanged files). This ensures the dashboard always reflects the latest state.

### Polling, Not WebSockets
The client polls `/api/sessions` every 5 seconds for updates. This keeps the server simple and stateless. The server health is checked every 10 seconds when up, every 2 seconds when down.

### Sub-Agent Message Handling
Sub-agents spawned via `task` or `read_agent` get their own tab in the session detail. Messages are filtered by `parentToolCallId` to separate threads. `read_agent` results are synthesized from `tool.execution_complete` events.

### Plan Mode
When `exit_plan_mode` is pending approval, the session shows "Needs attention" and the Plan tab auto-focuses. The plan content is read from `plan.md` in the session directory.

## Environment Variables

### Server
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port; auto-fallback to next free port if unset and 3001 is busy |
| `COPILOT_SESSION_STATE` | — | Override session-state root path(s); platform-delimited |

### Client (Vite)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_TARGET` | http://localhost:3001 | Proxy target for `/api` in dev |
| `HOST` | localhost | Bind address; set to `0.0.0.0` for LAN access |

### Dev Tunnels
| Variable | Default | Description |
|----------|---------|-------------|
| `DEVTUNNEL_TUNNEL_ID` | copiloting-agents-prod/copiloting-agents-client | Fixed tunnel ID for persistent URLs |

## Session Data Model

Sessions are stored in `~/.copilot/session-state/<uuid>/`:

```
session-state/
└── <session-uuid>/
    ├── events.jsonl        # append-only event log
    ├── inuse.<pid>.lock    # present only while process is running
    ├── plan.md             # plan content (if created)
    └── session.db          # SQLite with todos table
```

Key event types in `events.jsonl`:

| Event | Description |
|-------|-------------|
| `session.start` | Session initialized |
| `user.message` | User sent a message |
| `assistant.message` | Agent replied (may include toolRequests) |
| `assistant.turn_start` | Agent started processing |
| `assistant.turn_end` | Agent finished processing |
| `tool.execution_start` | Tool call started |
| `tool.execution_complete` | Tool call finished |
| `subagent.started` | Sub-agent spawned |
| `subagent.completed` / `subagent.failed` | Sub-agent finished |
| `session.task_complete` | Agent completed a task |
| `session.shutdown` | Session ended cleanly |
| `abort` | User cancelled current operation |

## Testing

This project currently has no automated test suite. Testing is done manually:

1. **Development**: Run `npm run dev` and verify both server and client start
2. **Session Detection**: Start a Copilot CLI session and confirm it appears in the dashboard
3. **Real-time Updates**: Send messages in Copilot and watch the dashboard update within 5 seconds
4. **Notifications**: Click "Enable notifications" and trigger a state that needs attention
5. **Mobile View**: Open `/m` route and verify touch-friendly interface
6. **Production Build**: Run `npm start` and verify single-port serving works

## Security Considerations

- **Local-only by default**: The server binds to localhost unless `HOST` is explicitly changed
- **No authentication**: Anyone on the network can access if bound to `0.0.0.0`
- **File system access**: Server reads files from user's home directory; no writes
- **Dev Tunnels**: Public URLs require Microsoft/GitHub authentication when accessed
- **CORS enabled**: Server allows cross-origin requests for local development

## Troubleshooting

### Port already in use
If port 3001 is busy and `PORT` is unset, the server automatically picks the next free port. In dev mode, the Vite proxy expects 3001, so either free that port or set `PORT` explicitly.

### Sessions not appearing
Check that `~/.copilot/session-state/` exists and contains session directories. On Windows, ensure WSL distributions are accessible. Set `COPILOT_SESSION_STATE` to override discovery.

### Mobile route not working
The mobile routes (`/m/*`) require JavaScript to render. Ensure the client bundle loaded correctly.

## Documentation References

- `README.md` — User-facing documentation and quick start
- `docs/client.md` — Detailed client architecture
- `docs/server.md` — Detailed server architecture
- `docs/session-model.md` — Session data format specification
- `docs/devtunnel.md` — Dev Tunnels workflow documentation
