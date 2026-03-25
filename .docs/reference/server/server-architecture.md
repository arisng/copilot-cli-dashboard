# Server Architecture Reference

Express 4 + TypeScript powers the API server, and the dev server runs with `tsx watch`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/sessions` | All sessions (active + closed), sorted by last activity |
| GET | `/api/sessions/:id` | Full session detail including messages |
| GET | `/api/sessions/:id/artifacts` | Read-only `plan.md`, `checkpoints/`, and `research/` discovery |
| GET | `/api/sessions/:id/session-db` | Read-only `session.db` schema metadata and row preview |

## Key files

- `src/sessionReader.ts` — core parsing logic; reads `events.jsonl` on every call
- `src/sessionTypes.ts` — raw event types and normalised API types
- `src/utils/needsAttention.ts` — event-driven status detection
- `src/router.ts` — Express route handlers
- `src/index.ts` — server entry, default port 3001 with auto-fallback to the next free port when run by production startup scripts with `PORT` unset

## Session parsing rules

- `isOpen` is determined by the presence of `inuse.<pid>.lock`.
- Brand-new sessions return a stub with `title: "New"` and `isIdle: true`.
- `model` comes from the last `session.model_change` event or `shutdownData.currentModel`.
- `needsAttention` is true when an open session has a `tool.execution_start` without a matching completion event or abort.

## Session detail inspector routes

Two read-only routes now back the desktop Session Detail inspector:

- `/api/sessions/:id/artifacts` resolves the session directory, reads `plan.md`, and recursively lists the `checkpoints/` and `research/` folders.
- `/api/sessions/:id/session-db` opens `session.db` read-only, enumerates tables, and returns the metadata and bounded row preview used by the client-side table/graph toggle.

Both routes fail explicitly when the session directory is missing or the underlying files cannot be read. They never mutate session state.

## Status state machine

`lastSessionStatus` is computed by scanning events forward and resetting state per user message:

```text
user.message         → reset all state
assistant.turn_start → inTurn = true
assistant.turn_end   → inTurn = false
session.task_complete → lastTurnHadTaskComplete = true
abort                → pendingAbort = true, inTurn = false
```

The returned status is one of `working`, `aborted`, `task_complete`, `idle`, or `null`.

## Related references

- [Client Architecture Reference](../client/client-architecture.md)
- [Session Data Model Reference](../session-state/session-data-model.md)

