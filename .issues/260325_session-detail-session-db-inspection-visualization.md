---
title: "Inspect session.db schema and visualize session-state data in Session Detail"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-25"
priority: "Medium"
---

## Summary

Add a diagnostic view in Session Detail that can open and render the `session.db` content from each Copilot session-state directory at `~\\.copilot\\session-state\\<session-id>\\session.db`.

The first step is to inspect the SQLite schema and derive a safe visualization plan before implementing. This enables users to quickly evaluate per-session internal state from the UI without manual file access.

## Problem Statement

- The current Session Detail UI does not expose the `session.db` snapshot that stores Copilot session-state data.
- Developers must inspect these databases manually on disk, causing context switching and extra effort.
- We do not yet know the exact schema; visualization should be schema-driven.

## Objectives

1. Locate active `session-state` session IDs in the in-app model (session list/selected session).
2. For each session, derive the path: `~\\.copilot\\session-state\\<session-id>\\session.db` (handle Windows and POSIX paths).
3. Inspect the SQLite schema, tables, and important columns (e.g., prompt history, tool state, checkpoints, metadata, status).
4. Design a UI representation in Session Detail (likely new tab or panel): tree/table of tables, ability to select table and show rows.
5. Define safe behavior when DB is locked/unreadable (existing file usage, backup copy, read-only view, error message).

## Requirements

- [ ] Add a backend API route in `server/` (/session-detail/session-db?sessionId=...) to collect and expose `session.db` metadata (table list, sample rows), safely and read-only.
- [ ] Add client UI in `client/src/components/SessionDetail/` for a new `Session DB` tab or section.
- [ ] Add schema inspection logic (`session-db-schema`) and a design doc for key fields including relationships, record timestamps, and context keys.
- [ ] Render `session.db` contents with: table picker, row limit (e.g., 50), and filtering by key/value.
- [ ] Ensure invalid or missing DB path shows actionable message pointing to expected path.
- [ ] Add tests (server integration and client component) for existing/absent DB path conditions.

## Acceptance Criteria

- [ ] Session Detail shows a way to inspect data from `~\\.copilot\\session-state\\<session-id>\\session.db`.
- [ ] UI surfaces schema information and a small row preview for at least one session table.
- [ ] DB access is read-only and includes locking/error handling.
- [ ] Feature applies to both desktop and web-based session detail if supported.

## Next Steps

1. Explore `server/src/sessionReader.ts` and `sessionTypes.ts` to confirm current session-state model and data paths.
2. Determine if `session.db` is created per session and which data is guaranteed present.
3. Draft visualization UX (for tables, events, current state, prompt history) based on schema and user scenarios.
4. Implement low-risk Prototype view in Session Detail with table-level listing first.
