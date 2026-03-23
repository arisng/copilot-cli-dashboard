# Server Architecture

Express 4 + TypeScript, runs with `tsx watch` in dev.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/sessions` | All sessions (active + closed), sorted by last activity |
| GET | `/api/sessions/:id` | Full session detail including messages |

## Key Files

- `src/sessionReader.ts` — core parsing logic; reads `events.jsonl` on every call
- `src/sessionTypes.ts` — raw event types and normalised API types
- `src/utils/needsAttention.ts` — event-driven status detection
- `src/router.ts` — Express route handlers
- `src/index.ts` — server entry, default port 3001 with auto-fallback to the next free port when run by production startup scripts with `PORT` unset

## Session Parsing Rules

- **`isOpen`** = lock file (`inuse.<pid>.lock`) present. Shutdown event is irrelevant.
- **Brand-new sessions** (lock file exists, no events yet) return a stub with `title: "New"`, `isIdle: true`.
- **Model** = last `session.model_change` event's `newModel`, falls back to `shutdownData.currentModel`.
- **`needsAttention`** = open session has a `tool.execution_start` with no matching `tool.execution_complete` and no `abort` event clearing it.

## Status State Machine (`lastSessionStatus`)

Forward scan, resets per user message:

```
user.message        → reset all state
assistant.turn_start → inTurn = true
assistant.turn_end   → inTurn = false
session.task_complete → lastTurnHadTaskComplete = true
abort               → pendingAbort = true, inTurn = false
```

Returns: `'working' | 'aborted' | 'task_complete' | 'idle' | null`
