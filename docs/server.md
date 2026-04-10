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

## Normalized Sub-Agent Taxonomy

`buildActiveSubAgents()` enriches each `ActiveSubAgent` with a normalized taxonomy defined in `sessionTypes.ts`. The taxonomy separates dispatch tools from runtime agent identity so filters and topology can operate on authoritative fields instead of label heuristics.

### Taxonomy Interfaces

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

### `ActiveSubAgent` Fields

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

### Classification Rules

- `task_complete` is `family: 'orchestration'` — it is **not** a sub-agent identity and is skipped during `buildActiveSubAgents()`.
- `read_agent` is `family: 'agent-management'` — tracked via `tool.execution_start` / `tool.execution_complete`, not `subagent.started`.
- `agent_idle` (from `system.notification`) marks the agent as idle, **not** completed. Completion requires `subagent.completed` or `tool.execution_complete`.
- Compacted sessions use pragmatic matching: `agent_idle` notifications without a direct `toolCallId` match are reconciled by `agentType` against known candidates; synthetic entries are created when both the `subagent.started` and the dispatch tool request were compacted away.

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
