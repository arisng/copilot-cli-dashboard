# About the Dashboard Architecture

The dashboard is designed around the Copilot session-state directory as a local source of truth.

## Background

Instead of depending on an external service, the application reads session files directly from disk and reconstructs state from the event log.

## Why the data model is local

Copilot CLI already writes everything needed to understand a session: the current lock file, the append-only `events.jsonl` stream, and the event payloads that describe messages, tool calls, and session status.

That makes the dashboard fast to reason about and keeps it usable without network access.

## Why the server rereads files on every request

The API does not keep its own database or cache. Each request re-parses the session directory so the response always reflects the latest file state.

This keeps the implementation simple and makes the filesystem the single source of truth.

## Why the client polls

The browser refreshes session data on a fixed interval instead of waiting for pushes. Polling matches the filesystem-backed model and avoids additional infrastructure for live synchronization.

## Why Windows support spans local and WSL sessions

On Windows, sessions can live in the native profile or inside accessible WSL distributions. The dashboard checks both so that the same browser UI can show every session the user can reach.

## What this architecture avoids

- No Copilot API dependency
- No server-side database
- No cache invalidation layer
- No websocket coordination for live updates

## Further reading

- [Getting Started with Copilot Sessions Dashboard](../../tutorials/dashboard/getting-started.md)
- [Commands Reference](../../reference/operations/commands.md)
- [Server Architecture Reference](../../reference/server/server-architecture.md)
- [Session Data Model Reference](../../reference/session-state/session-data-model.md)

