# Copilot Sessions Dashboard

A local web dashboard that reads `~/.copilot/session-state/` and displays active Copilot CLI sessions in real time — with message history, tool call inspection, and browser notifications.

## Commands

Run from the **repo root**:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server (port 3001) and client (port 5173) concurrently |
| `npm run build` | Build server and client for production |

Individual workspaces:

| Command | Description |
|---------|-------------|
| `npm run dev --workspace=server` | Server only (tsx watch, hot-reload) |
| `npm run dev --workspace=client` | Client only (Vite HMR) |

## Architecture

- **`server/`** — Express API (`/api/sessions`, `/api/sessions/:id`, `/api/health`). Reads `.jsonl` event files from `~/.copilot/session-state/` on every request. No database, no caching.
- **`client/`** — React 18 + Vite + Tailwind CSS. Polls the API every 5 seconds. Single-page app with session list and session detail routes.

## Key Conventions

- **Session state source of truth:** lock file (`inuse.<pid>.lock`) determines `isOpen`; absence of `session.shutdown` event is irrelevant.
- **No server-side caching:** `listAllSessions()` and `parseSessionDir()` read the filesystem fresh on every API call.
- **Polling, not websockets:** client polls `/api/sessions` every 5 s for updates.
- **TypeScript strict:** both workspaces use strict TypeScript; no `any`.
- **Tailwind only:** no CSS modules, no styled-components. All styling via Tailwind utility classes with `gh-*` custom color tokens.

## Detailed Guidelines

- [Client Architecture](docs/client.md)
- [Server Architecture](docs/server.md)
- [Session Data Model](docs/session-model.md)
