# Session Data Model Reference

Copilot sessions are stored as newline-delimited JSON under `~/.copilot/session-state/<uuid>/events.jsonl`. The dashboard reads that file directly and derives session list/detail state from the event stream plus a few filesystem artifacts.

## Event envelope

Every line in `events.jsonl` uses the same outer shape:

```json
{
  "type": "assistant.message",
  "data": { "...": "..." },
  "id": "645b406d-b98d-4b6a-8451-5a54f6d66a83",
  "timestamp": "2026-04-12T03:26:00.949Z",
  "parentId": "5644ed64-aae9-417e-85fd-4857b1d8ae46"
}
```

## Correlation rules

The dashboard uses two different relationship signals:

| Field | Meaning |
|---|---|
| `parentId` | Append-only lineage between adjacent events. Useful for chronology and provenance, but **not** sufficient on its own for sub-agent thread grouping. |
| `data.parentToolCallId` | Thread correlation key for sub-agent messages and tool executions when present. This is the field used to build sub-agent message tabs. |

Observed reality:

- Nearly every event has a `parentId`.
- Only some event families include `data.parentToolCallId`.
- Root-thread events commonly have **no** `data.parentToolCallId`.
- Sub-agent lifecycle events such as `system.notification` may have neither `data.parentToolCallId` nor a direct `toolCallId`, so the dashboard falls back to pragmatic reconciliation.

## Directory structure

```text
session-state/
└── <session-uuid>/
    ├── events.jsonl             # append-only event stream
    ├── inuse.<pid>.lock         # lock file present while session is active
    ├── plan.md                  # session plan (present only when /plan is used)
    ├── session.db               # per-session SQLite DB
    ├── workspace.yaml           # session metadata
    ├── vscode.metadata.json     # VS Code integration metadata (may be {})
    ├── checkpoints/
    │   ├── index.md             # checkpoint table of contents
    │   └── NNN-<slug>.md        # numbered checkpoint files
    ├── files/                   # session-scoped user artifacts
    ├── research/                # research report outputs
    └── rewind-snapshots/
        ├── index.json           # snapshot manifest
        └── backups/
            └── <hash>-<timestamp>  # content-addressed file backups
```

On Linux and WSL this is typically `~/.copilot/session-state/<uuid>/`. On Windows, the dashboard also discovers accessible WSL distributions automatically.

## Observed event types

| Event type | Purpose | Notable fields |
|---|---|---|
| `session.start` | Session creation | `copilotVersion`, `remoteSteerable`, `context.repository`, `context.hostType`, `context.baseCommit` |
| `session.resume` | Session reopened | `selectedModel`, `reasoningEffort`, updated `context`, `eventCount` |
| `session.shutdown` | Session closed | usage totals, `currentModel`, token counters |
| `session.error` | Runtime failure surfaced by CLI | `errorType`, `message`, `statusCode`, `providerCallId` |
| `session.info` | Informational event | `infoType`, `message` |
| `session.model_change` | Model switch | `previousModel`, `newModel`, reasoning-effort changes |
| `session.mode_changed` | Interaction mode switch | `previousMode`, `newMode` (`interactive`, `plan`, `autopilot`) |
| `session.plan_changed` | Plan file created/updated | `operation` |
| `session.workspace_file_changed` | Session workspace artifact mutation | `path`, `operation` |
| `session.compaction_start` | Context compaction began | token counters |
| `session.compaction_complete` | Context compaction finished | `summaryContent`, checkpoint info, token usage |
| `session.truncation` | Message history truncated | token/message deltas, `performedBy` |
| `session.task_complete` | Main agent declared completion | `summary`, `success` |
| `user.message` | User prompt | `content`, `transformedContent`, `attachments`, `agentMode`, `interactionId` |
| `assistant.turn_start` | Turn begins | `turnId`, `interactionId` |
| `assistant.message` | Assistant output | `toolRequests`, `reasoningText`, `reasoningOpaque`, `requestId`, optional encrypted content |
| `assistant.turn_end` | Turn ends | `turnId` |
| `tool.execution_start` | Tool call started | `toolCallId`, `toolName`, `arguments` |
| `tool.execution_complete` | Tool call finished | `toolCallId`, `success`, optional `result`/`error`, `model`, `toolTelemetry` |
| `subagent.selected` | Custom agent mode selected | `agentName`, `agentDisplayName`, `tools` |
| `subagent.started` | Worker agent launched | `toolCallId`, `agentName`, `agentDisplayName`, `agentDescription` |
| `subagent.completed` | Worker completed | `toolCallId`, `agentName`, `agentDisplayName` |
| `subagent.failed` | Worker failed | `toolCallId`, `error`, `totalToolCalls`, `durationMs` |
| `system.notification` | Runtime/system status | `kind.type` observed: `agent_idle`, `agent_completed`, `shell_completed` |
| `skill.invoked` | Skill loaded into context | `name`, `path`, `description`, `content` |
| `hook.start` | Hook execution started | `hookInvocationId`, `hookType`, `input` |
| `hook.end` | Hook execution ended | `hookInvocationId`, `hookType`, `success` |
| `abort` | User cancelled current operation | — |

## Dashboard correlation matrix

| Raw event | Server use | Client use | Notes |
|---|---|---|---|
| `session.start` | Session identity, start time, initial context | List/detail metadata | `context` may later be superseded by `session.resume` |
| `session.resume` | Latest context + selected model fallback | Indirect via summary/detail fields | Newer logs use this heavily; not just `session.start` |
| `session.shutdown` | Usage totals, model fallback | Detail/list metrics | Exact when present |
| `session.error` | `lastError` summary/detail field | Status badge, detail callout, mobile state, notifications | Surfaces rate limits and similar blocks |
| `session.model_change` | Primary model source | Model chip | Preferred over shutdown fallback |
| `session.mode_changed` | `currentMode` | `ModeBadge`, detail border, list border | `autopilot` is the current observed value |
| `user.message` | Parsed messages, previews, title extraction | Main thread | Root-thread only for previews/counts |
| `assistant.message` | Parsed messages + tool requests | Main thread, workflow view, tool blocks | Tool results are attached from matching `tool.execution_complete` |
| `assistant.turn_start/end` | Working/idle derivation, usage estimates | Indirect status only | Must be preserved during compaction |
| `tool.execution_start/complete` | Pending-work tracking, needs-attention, tool results, sub-agent completion | Tool blocks, workflow graph | `tool.execution_complete.toolName` is optional in observed logs |
| `subagent.started/completed/failed` | `activeSubAgents` | Sub-agent tabs, counts, workflow enrichment | `agentDescription` is now used when available |
| `system.notification` (`agent_idle`) | Idle-state reconciliation for sub-agents | Indirect via sub-agent state | `agent_completed` / `shell_completed` are still not surfaced |
| `session.task_complete` | `task_complete` message + summary status | Status badges, message thread | Root thread only |
| `session.plan_changed` | No explicit event parsing; plan file existence drives state | Plan tab | Event is currently informational only |
| `session.workspace_file_changed` | Not yet surfaced | — | Useful future candidate for artifact timeline |
| `session.truncation` | Not yet surfaced | — | Important when debugging lost history |
| `session.compaction_*` | Not surfaced directly | — | Context compaction side effects still matter |
| `skill.invoked` | Not surfaced | — | Useful future candidate for audit/debug UI |
| `subagent.selected` | Not surfaced | — | Custom agent mode activation is currently invisible |
| `hook.start/end` | Not surfaced | — | Mostly operational noise today |

## Known drift points

1. **Mode naming changed**: current logs emit `autopilot`; older comments/code may still say `auto`.
2. **`tool.execution_complete` is richer than older types**: `model` and `toolTelemetry` are present, while `toolName` may be absent.
3. **`user.message.source` is no longer reliable**: newer logs commonly include `attachments` and `agentMode` instead.
4. **`session.resume` matters**: model/context can change after the original `session.start`.
5. **Not every raw event becomes UI**: several event families remain audit-only today by design.

## `ask_user` tool schemas

Two argument formats still exist in the wild:

**Old format**

```json
{ "question": "...", "choices": ["A", "B"], "allow_freeform": true }
```

**New format**

```json
{
  "message": "...",
  "requestedSchema": {
    "properties": {
      "fieldName": { "enum": ["A", "B"], "title": "Label", "type": "string" }
    },
    "required": ["fieldName"]
  }
}
```

Observed result prefixes include:

- `User selected: ...`
- `User responded: ...`
- `User cancelled the request.`

## Related references

- [Server Architecture Reference](../server/server-architecture.md)
- [Client Architecture Reference](../client/client-architecture.md)

