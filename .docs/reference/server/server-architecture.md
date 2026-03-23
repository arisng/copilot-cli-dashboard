# Server Architecture Reference

Express 4 + TypeScript powers the API server, and the dev server runs with `tsx watch`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/sessions` | All sessions (active + closed), sorted by last activity |
| GET | `/api/sessions/:id` | Full session detail including messages |

## Key files

- `src/sessionReader.ts` — core parsing logic; reads `events.jsonl` on every call
- `src/sessionTypes.ts` — raw event types and normalised API types
- `src/utils/needsAttention.ts` — event-driven status detection
- `src/router.ts` — Express route handlers
- `src/index.ts` — server entry, port 3001

## Session parsing rules

- `isOpen` is determined by the presence of `inuse.<pid>.lock`.
- Brand-new sessions return a stub with `title: "New"` and `isIdle: true`.
- `model` comes from the last `session.model_change` event or `shutdownData.currentModel`.
- `needsAttention` is true when an open session has a `tool.execution_start` without a matching completion event or abort.

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

