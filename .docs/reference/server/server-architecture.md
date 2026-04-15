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

- **`isOpen`** = lock file (`inuse.<pid>.lock`) present. Shutdown event is irrelevant.
- **Brand-new sessions** (lock file exists, no events yet) return a stub with `title: "New"`, `isIdle: true`.
- **Model** = last `session.model_change` event's `newModel`, then latest `session.resume.selectedModel`, then `shutdownData.currentModel`.
- **Context** = `session.start.context`, updated by later `session.resume.context` when present.
- **`lastError`** = last `session.error` event (`errorType`, `message`, optional `statusCode`).
- **`needsAttention`** = open session has a `tool.execution_start` with no matching `tool.execution_complete` and no `abort` event clearing it.
- **Summary scan vs detail parse**:
  - List summaries keep a reduced event stream for cache efficiency.
  - Full detail reads the complete `events.jsonl`.
  - `system.notification` is preserved in the reduced stream so summary/detail sub-agent state stays aligned.

## Normalized sub-agent taxonomy

`buildActiveSubAgents()` enriches each `ActiveSubAgent` with a normalized taxonomy defined in `sessionTypes.ts`. The taxonomy separates dispatch tools from runtime agent identity so filters and topology can operate on authoritative fields instead of label heuristics.

### Taxonomy interfaces

```ts
interface DispatchInfo {
  toolName: string;                  // 'task' | 'read_agent'
  family: 'agent-management' | 'orchestration' | 'tool';
  toolCallId: string;                // authoritative per-dispatch correlation key
}

interface AgentIdentity {
  targetName: string;                // runtime target: 'explore', 'general-purpose', custom name
  targetKind: 'built-in' | 'custom' | 'orchestrator' | 'unknown';
  instanceId: string;                // human-readable alias (e.g. "audit-modules")
}

interface ModelInfo {
  name: string | null;
  source: 'dispatch-override' | 'custom-agent-default' | 'session-fallback' | 'inferred' | null;
}

interface StatusInfo {
  scope: 'session' | 'dispatch' | 'worker';
  kind: 'pending' | 'running' | 'completed' | 'error' | 'idle';
  sourceEvent: string;               // event type that determined this status
}
```

### `ActiveSubAgent` fields

Each `ActiveSubAgent` carries both legacy fields (for backward compat) and the new taxonomy fields:

| Field | Description |
|-------|-------------|
| `toolCallId` | Per-dispatch correlation key (canonical) |
| `agentId` | Human-readable alias or display grouping key |
| `agentName` | Raw agent type from `subagent.started` (e.g. `general-purpose`) |
| `agentDisplayName` | UI label for the agent instance |
| `dispatch` | `DispatchInfo` — which tool dispatched this agent and its family |
| `agent` | `AgentIdentity` — runtime target, kind, and instance alias |
| `modelInfo` | `ModelInfo` — model name plus provenance source |
| `status` | `StatusInfo` — completion state scoped to session/dispatch/worker |

### Classification rules

- `task_complete` is `family: 'orchestration'` — it is **not** a sub-agent identity and is skipped during `buildActiveSubAgents()`.
- `read_agent` is `family: 'agent-management'` — tracked via `tool.execution_start` / `tool.execution_complete`, not `subagent.started`.
- `agent_idle` (from `system.notification`) marks the agent as idle, **not** completed. Completion requires `subagent.completed` or `tool.execution_complete`.
- `subagent.started.agentDescription` is used as a fallback description when the original dispatch request has been compacted away.
- Compacted sessions use pragmatic matching: `agent_idle` notifications without a direct `toolCallId` match are reconciled by `agentType` against known candidates; synthetic entries are created when both the `subagent.started` and the dispatch tool request were compacted away.

## Session detail inspector routes

Two read-only routes back the desktop Session Detail inspector:

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

## Compaction safety notes

- `assistant.turn_end` must be retained during compaction because:
  - `lastSessionStatus()` needs it to switch from working → idle.
  - Assistant-turn duration estimates use `turn_start`/`turn_end` pairs.
- `session.error`, `session.truncation`, `skill.invoked`, `subagent.selected`, and `session.workspace_file_changed` are currently observed in real logs even if they are not all surfaced in the UI yet.

## Related references

- [Client Architecture Reference](../client/client-architecture.md)
- [Session Data Model Reference](../session-state/session-data-model.md)

