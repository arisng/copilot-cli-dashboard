# Workflow Topology

Reference for `WorkflowTopologyView.tsx` and the normalized taxonomy it depends on.

## Conceptual Model

Each topology round maps to one assistant turn:

```
User Prompt → Main Agent (round 1) → Tool Calls / Sub-Agents / Detached Shells
            → Main Agent (round 2) → …
            → Final Result
```

Rounds are identified by `roundIndex`. The main agent node for each round is the orchestrator; response nodes are the tools or workers it dispatched.

## Node Types

| Type | When created | Phase |
|------|-------------|-------|
| `user-prompt` | First user message | Phase 1 |
| `main-agent` | Each assistant turn with tool requests; also `task_complete` / `exit_plan_mode` | Phase 1 |
| `tool-call` | Every tool request; `task`/`read_agent` start here and may be upgraded | Phase 1 |
| `detached-shell` | `shell` tool call with `detached: true` | Phase 1 |
| `sub-agent` | Upgraded from `tool-call` when server `ActiveSubAgent` data exists | Phase 2 |
| `result` | Last assistant message with no tool requests | Phase 1 |

## Two-Phase Pipeline

### Phase 1 — `buildMultiTurnGraph(messages: ParsedMessage[])`

Parses `ParsedMessage[]` and builds raw rounds. Key decisions:

- `task` and `read_agent` → `type: 'tool-call'` with `metadata.backgroundMode = (args.mode === 'background')`.
- `task_complete`, `exit_plan_mode` → `type: 'main-agent'` (orchestration class, not a worker node).
- `shell { detached: true }` → `type: 'detached-shell'`.
- All other tools → `type: 'tool-call'`.
- "Processing..." assistant messages (no content, no tool requests) are skipped; their response nodes are merged into the previous round.

### Phase 2 — Enrichment useMemo

```ts
const agentByToolCallId = new Map(activeSubAgents.map(a => [a.toolCallId, a]));
const updatedNodes = rawNodes.map(node => {
  const agent = agentByToolCallId.get(node.metadata?.toolCallId);
  if (!agent) return node;           // no server data → stays tool-call
  return {
    ...node,
    type: 'sub-agent',
    label: agent.agentDisplayName,
    model: agent.modelInfo?.name,
    status: agent.isCompleted ? 'completed' : (node.status || 'running'),
    metadata: {
      ...node.metadata,
      dispatch: agent.dispatch,
      agent: agent.agent,
      model: agent.modelInfo,
      backgroundInfo: { detached: !!node.metadata?.backgroundMode },
    },
  };
});
```

`backgroundMode` set in Phase 1 drives `backgroundInfo.detached` in Phase 2, which controls the "BACKGROUND TASK" vs "SUB AGENT" badge.

## Normalized Taxonomy on Nodes

Each node's `metadata` carries normalized fields from `sessionTypes.ts`:

```ts
metadata: {
  toolCallId: string;           // authoritative per-dispatch correlation key
  toolName: string;             // original tool name
  dispatch: DispatchInfo;       // { toolName, family, toolCallId }
  agent?: AgentIdentity;        // { targetName, targetKind, instanceId }
  model?: ModelInfo;            // { name, source }
  backgroundMode?: boolean;     // Phase 1 flag: args.mode === 'background'
  backgroundInfo?: {            // Phase 2 flag: drives badge
    detached: boolean;
    processId?: string;
  };
}
```

### `dispatch.family` values

| Family | Tools |
|--------|-------|
| `agent-management` | `task`, `read_agent` |
| `orchestration` | `task_complete`, `exit_plan_mode`, `plan_mode` |
| `execution` | `shell` (detached) |
| `tool` | everything else |

### `agent.targetKind` values

| Kind | Meaning |
|------|---------|
| `built-in` | Known Copilot CLI agent (e.g. `explore`, `general-purpose`, `code-review`) |
| `custom` | Custom agent from user configuration |
| `orchestrator` | Main session agent |
| `unknown` | Could not be determined |

## Badge and Color Reference

| `type` | `backgroundInfo.detached` | Badge text | Border |
|--------|--------------------------|-----------|--------|
| `user-prompt` | — | *(none)* | `gh-accent` blue |
| `main-agent` | — | `orchestrator` | purple |
| `tool-call` | — | `tool call` | `gh-muted` grey |
| `tool-call` (agent-mgmt) | — | `tool call` | indigo |
| `sub-agent` | `false` | `sub agent` | sky-400 |
| `sub-agent` | `true` | `background task` | sky-500 |
| `detached-shell` | — | `detached shell` | amber |
| `result` | — | *(none)* | `gh-active` green |

## Filter Behavior

`applyNodeFilter(enrichedRounds, enrichedNodes, enrichedEdges, filter)` is applied after Phase 2. Core types (`user-prompt`, `main-agent`, `result`) are never hidden.

| `filter.nodeType` | Hidden |
|-------------------|--------|
| `agents-only` | `tool-call` |
| `tools-only` | `sub-agent`, `detached-shell` |
| `all` | nothing |

`filter.agentTypes` and `filter.dispatchFamilies` filter non-core nodes by their taxonomy metadata.

## Model Provenance Display

| `modelInfo.source` | Display |
|--------------------|---------|
| `dispatch-override` | plain text |
| `custom-agent-default` | plain text |
| `session-fallback` | plain text |
| `inferred` | `~ model-name` (italic, muted) |

## Bug Fix History

Four bugs were fixed when the two-phase pipeline was introduced:

1. **Dispatch nodes created as `sub-agent` (Phase 1)** — Fixed by emitting `type: 'tool-call'` in Phase 1; Phase 2 upgrades to `sub-agent`.
2. **Dead enrichment step** — Phase 2 was checking `existingToolCallIds` which contained every dispatch node's `toolCallId`, so the upgrade was always skipped. Fixed by replacing "add new nodes" with "upgrade matching nodes by toolCallId".
3. **Enriched nodes had no round assignment** — `applyNodeFilter` was called on `rawRounds` instead of `updatedRounds` (the enriched rounds). Fixed by passing `enrichedRounds` to `applyNodeFilter`.
4. **All sub-agents showed "BACKGROUND TASK"** — The `detached` flag was derived from `agent.status?.scope === 'worker'`, which is true for every agent. Fixed by storing `backgroundMode: args.mode === 'background'` in Phase 1 metadata and reading it in Phase 2.
