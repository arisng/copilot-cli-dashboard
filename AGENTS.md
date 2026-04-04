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
  - `better-sqlite3` — reads session-store.db for session catalog and checkpoints
  - `cors` — cross-origin requests from Vite dev server
  - `js-yaml` — YAML parsing for workspace.yaml

### Client
- **Framework**: React 18 with hooks
- **Build Tool**: Vite 5
- **Language**: TypeScript 5 with strict mode
- **Styling**: Tailwind CSS 3 with custom `gh-*` color tokens (GitHub-inspired dark theme)
- **Routing**: React Router 6
- **Key Dependencies**:
  - `react-markdown` + `remark-gfm` — renders plan.md and checkpoint content
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

Remote access via tunnels:

| Command | Description |
|---------|-------------|
| `npm run tunnel:cloudflare` | Expose production server via Cloudflare Quick Tunnel (recommended) |
| `npm run tunnel:prod` | Expose production server via Microsoft Dev Tunnels (fallback) |
| `npm run tunnel:client` | Expose Vite dev server via Dev Tunnels (legacy)

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
| GET | `/api/sessions/:id` | Full session detail including messages, plan, todos, checkpoints |

**Session Reader** (`server/src/sessionReader.ts`):

- Discovers session roots: `~/.copilot/session-state/` plus WSL distributions on Windows
- Override with `COPILOT_SESSION_STATE` environment variable (path-delimited)
- Queries `~/.copilot/session-store.db` SQLite for canonical session catalog
- Parses `events.jsonl` (newline-delimited JSON) for each session
- Reads `workspace.yaml` for session metadata
- Reads `checkpoints/index.md` and individual checkpoint files
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
- `SessionDetail` — message thread with auto-scroll, tabbed sub-agent views, checkpoints tab
- `MessageBubble` — renders user/assistant/task_complete messages with tool call blocks
- `SessionTabNav` — tabs for Main, Plan, Todos, Checkpoints, and each sub-agent thread

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

### Checkpoints
Checkpoints created via `/compact` are stored in `checkpoints/` directory with XML-tagged markdown sections. The dashboard displays checkpoint history from both `checkpoints/index.md` and the `checkpoints` table in `session-store.db`.

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

### Tunnels
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Target port for tunnel commands (must match server port) |

### Dev Tunnels (fallback)
| Variable | Default | Description |
|----------|---------|-------------|
| `DEVTUNNEL_TUNNEL_ID` | copiloting-agents-prod/copiloting-agents-client | Fixed tunnel ID for persistent URLs |

## Session Directory Structure (`~/.copilot/session-state/<uuid>/`)

Each session occupies its own UUID-named directory:

```
<uuid>/
├── checkpoints/                         # [empirical]
│   ├── index.md                         # Checkpoint table of contents
│   └── NNN-<slug>.md                    # Numbered checkpoint files
├── files/                               # Session-scoped user artifacts [empirical]
├── research/                            # Research report outputs [empirical]
├── rewind-snapshots/                    # [empirical]
│   ├── index.json                       # Snapshot manifest
│   └── backups/
│       └── <hash>-<timestamp>           # Content-addressed file backups
├── events.jsonl                         # Append-only event stream [empirical; absent in fresh sessions]
├── inuse.<pid>.lock                     # Lock file present while session is active [empirical]
├── plan.md                              # Session plan (present only when /plan is used) [empirical]
├── session.db                           # Per-session SQLite DB [empirical; purpose unknown]
├── vscode.metadata.json                 # VS Code integration metadata (may be {}) [empirical]
└── workspace.yaml                       # Session metadata [empirical]
```

### `workspace.yaml` Field Reference `[empirical]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Session identifier; matches the directory name |
| `cwd` | string (path) | Working directory at session start |
| `git_root` | string (path) | Git repository root (may equal `cwd`) |
| `repository` | string | GitHub repo in `owner/repo` format |
| `host_type` | string | Authentication host type (e.g., `github`) |
| `branch` | string | Git branch name at session start |
| `summary` | string | Human-readable session name; set via `/rename` |
| `summary_count` | integer | Number of compaction summaries generated |
| `created_at` | ISO 8601 | Session creation timestamp |
| `updated_at` | ISO 8601 | Timestamp of last recorded activity |

### `events.jsonl` Event Type Catalog `[empirical]`

Each event follows this envelope structure:

```json
{
  "type": "<event-type>",
  "data": { ... },
  "id": "<uuid>",
  "timestamp": "<ISO8601>",
  "parentId": "<uuid>|null"
}
```

#### Session Lifecycle Events

| Event Type | Description |
|------------|-------------|
| `session.start` | First event emitted when a new session is created |
| `session.resume` | Emitted when an existing session is reopened |
| `session.shutdown` | Emitted on clean session termination |
| `session.task_complete` | Emitted when the agent marks a task done |
| `session.compaction_start` | Begins context compaction (`/compact`) |
| `session.compaction_complete` | Ends context compaction |

#### Session State Events

| Event Type | Description |
|------------|-------------|
| `session.model_change` | Model or reasoning effort changed |
| `session.info` | Informational message (e.g., model confirmation) |
| `session.mode_changed` | Session mode changed (e.g., plan ↔ interactive) |
| `session.plan_changed` | `plan.md` was created or updated |

#### Conversation Events

| Event Type | Description |
|------------|-------------|
| `user.message` | User prompt submitted |
| `assistant.turn_start` | Assistant begins processing |
| `assistant.message` | Agent message (may include toolRequests) |
| `assistant.turn_end` | Assistant turn complete |

#### Tool and Agent Events

| Event Type | Description |
|------------|-------------|
| `tool.execution_start` | Tool invocation begins |
| `tool.execution_complete` | Tool invocation ends |
| `subagent.started` | Sub-agent dispatched |
| `subagent.completed` | Sub-agent finished successfully |
| `subagent.failed` | Sub-agent finished with error |
| `hook.start` | Lifecycle hook begins |
| `hook.end` | Lifecycle hook ends |
| `abort` | User cancelled current operation |

### Checkpoint File Format `[empirical]`

#### `checkpoints/index.md`

Markdown table linking checkpoint numbers to file names:

```markdown
| # | Title | File |
|---|-------|------|
| 1 | Session summary title | 001-session-summary-title.md |
```

#### `checkpoints/NNN-<slug>.md`

Each checkpoint uses XML-tagged sections:

```markdown
<overview>
One-paragraph summary of the session so far.
</overview>

<history>
1. Numbered list of major work items completed.
2. ...
</history>

<work_done>
Files created/modified, with brief descriptions.
</work_done>

<technical_details>
Key technical choices, APIs used, error patterns.
</technical_details>
```

## Central Session Catalog (`~/.copilot/session-store.db`) `[official + empirical]`

The session store is a SQLite database that serves as the canonical index of all sessions. It is a subset of the full data stored in session files.

### Schema

```sql
-- Core session metadata
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT,
    repository TEXT,
    branch TEXT,
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    host_type TEXT
);

-- Full conversation turns
CREATE TABLE turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    turn_index INTEGER NOT NULL,
    user_message TEXT,
    assistant_response TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, turn_index)
);

-- Checkpoint summaries
CREATE TABLE checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    checkpoint_number INTEGER NOT NULL,
    title TEXT,
    overview TEXT,
    history TEXT,
    work_done TEXT,
    technical_details TEXT,
    important_files TEXT,
    next_steps TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, checkpoint_number)
);

-- File modification tracking
CREATE TABLE session_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    file_path TEXT NOT NULL,
    tool_name TEXT,
    turn_index INTEGER,
    first_seen_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, file_path)
);

-- PR/commit/issue cross-references
CREATE TABLE session_refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    ref_type TEXT NOT NULL,   -- 'commit', 'pr', 'issue'
    ref_value TEXT NOT NULL,
    turn_index INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, ref_type, ref_value)
);

-- FTS5 full-text search index
CREATE VIRTUAL TABLE search_index USING fts5(
    content,
    session_id UNINDEXED,
    source_type UNINDEXED,
    source_id UNINDEXED
);
```

## Log Files `[empirical]`

```
~/.copilot/logs/
├── copilot.log                    # Persistent global log (auth, updates)
└── process-<timestamp>-<pid>.log  # Per-process log (startup, session init)
```

`<timestamp>` follows `YYYYMMDDTHHMMSSZ` format. Entry format:

```
<ISO8601> [LEVEL] [context?] Message
```

Observed levels: `INFO`, `DEBUG`, `WARN`, `ERROR`

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
- `docs/remote-access.md` — Remote access guide (Cloudflare, Tailscale, Dev Tunnels)
- `docs/devtunnel.md` — Dev Tunnels fallback documentation
