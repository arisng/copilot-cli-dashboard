---
title: "Normalize Copilot CLI workflow topology: separate tool calls, sub-agents, and detached shells"
type: "RFC"
status: "Resolved"
author: "GitHub Copilot"
created: "2026-04-10"
priority: "High"
description: "Consolidated workflow-topology and taxonomy issue defining how the dashboard should distinguish dispatch tools, runtime workers, and detached shell sessions in Copilot CLI session data."
---

## Summary

The current dashboard model collapses several different Copilot CLI concepts into the same few fields. In particular, the repo mixes dispatch tools such as `task` and `read_agent`, orchestration/state markers such as `task_complete`, runtime agent targets such as `explore` or `general-purpose`, human-facing agent aliases such as `audit-modules`, and inferred model labels.

That ambiguity is now affecting multiple surfaces: `ActiveSubAgent`, workflow-topology nodes, sub-agent/thread filters, and any future analytics built on top of those models. This RFC documents the current semantic drift, defines the authoritative distinctions the dashboard should preserve, and proposes a normalized taxonomy so the app can map Copilot CLI session state without conflating tool names with agent identity.

This issue now also absorbs the prior workflow-topology enhancement plan so the semantic model and the intended topology behavior live in one place.

## Problem Statement

- The current server model uses `ActiveSubAgent.agentName` for incompatible meanings depending on which event produced the row.
- The current client model and topology builder disagree about what `WorkflowNode.agentName` means.
- The topology view infers `agentType` and `model` from display labels when authoritative data is partial or absent.
- Some surfaces treat `task_complete` as if it belongs to the same sub-agent identity lane as `task`, even though it is an orchestration/state tool.
- Some surfaces either drop `read_agent` from topology or treat `agent-management` tools as if they were background worker nodes.
- Detached shell sessions are a distinct runtime surface in Copilot CLI, but they are not yet expressed clearly in the normalized topology semantics.
- The repo's local reference docs do not yet provide a normalized glossary for tool family vs runtime agent target vs agent instance vs display label.

## Goals

1. Define an authoritative semantic model for sub-agent-related session data in this repo.
2. Clearly separate dispatch tools from runtime agent targets.
3. Make filter and topology behavior depend on normalized fields instead of label heuristics.
4. Preserve enough provenance to distinguish authoritative values from inferred fallbacks.
5. Give future implementation work a precise acceptance target without solving the implementation in this issue.

## Non-Goals

- Implementing the refactor described here.
- Reverse-engineering undocumented Copilot CLI internals beyond the evidence currently available.
- Redesigning unrelated Session Detail UX.

## Current Mapping Critique

### 1. `ActiveSubAgent.agentName` is overloaded

The server currently stores three different concepts in `ActiveSubAgent.agentName`:

- the runtime agent target from `subagent.started`
- the dispatch tool name `task` or `task_complete` when synthesizing from `assistant.message` tool requests
- the dispatch tool name `read_agent` when synthesizing async reads

This means a filter or badge keyed on `agentName` cannot tell whether it is looking at a real runtime agent target, a dispatch mechanism, or an orchestration helper.

### 2. `ActiveSubAgent.agentId` is being used as both grouping key and display identity

The current server logic derives `agentId` from a mix of `task` arguments, `read_agent` arguments, fallback display labels, and synthetic compacted-event placeholders. That makes it useful as a human-facing alias, but not sufficiently authoritative to serve as the primary correlation key for dispatch-level analytics or topology joins.

The safe correlation key is `toolCallId`. Human-readable `agentId` can still exist, but it should not replace per-dispatch identity.

### 3. `task_complete` is not the same kind of thing as `task`

The current code path includes `task_complete` in the same sub-agent construction lane as `task`. The authoritative references do not support that conflation:

- `task` and `read_agent` live in the agent-management family
- `task_complete` lives in the orchestration/state family
- `session.task_complete` is a session event, not a runtime agent target

The dashboard should not count `task_complete` as a sub-agent identity or agent-type bucket.

### 4. `WorkflowNode.agentName` has contradictory semantics

The client API comments say `WorkflowNode.agentName` is the tool name, but the topology builder populates it with the human or custom agent name while storing the actual tool name in `metadata.toolName`.

This makes the client contract internally inconsistent and makes downstream consumers guess which meaning is present.

### 5. `agentType` is partly heuristic instead of authoritative

The topology view currently infers agent categories from label substrings such as `coder`, `explore`, `review`, `audit`, or `doc`. That is fragile for custom agents and for human-readable aliases that do not embed the runtime target in the label.

The dashboard should prefer authoritative runtime data when it exists, and only expose heuristics as explicit fallbacks.

### 6. `model` is partly inferred from aliases

The topology view infers model names from the `agentId` string when no explicit model is present. That may be useful as a temporary hint, but it is not authoritative model provenance and should not be treated as equivalent to an explicit model selection.

### 7. `read_agent` is meaningful orchestration data, but it is still a tool surface

The current workflow topology builder identifies `read_agent` as sub-agent-related and then drops it entirely from the graph. That makes the topology surface disagree with other dashboard surfaces that already expose `read_agent` activity.

The dashboard should not treat `read_agent` as a `sub-agent` node. It is a documented `agent-management` tool and should remain a `tool-call` node, with any later worker node derived from actual worker lifecycle evidence rather than from the management tool itself.

### 8. `sessionId` for sub-agents should be treated as empirical, not contractual

The current server model exposes `sessionId` as if each sub-agent has its own session directory identity. The authoritative topology mental model says sub-agents are workers within the same session orchestration container, not separate top-level sessions. If current raw events still expose a `sessionId`, the dashboard should treat that field as empirical and optional until it is revalidated against fresh traces.

## Why This Matters

- Tool-vs-agent ambiguity will produce incorrect filter buckets.
- Topology rendering will mislabel nodes or hide meaningful orchestration steps.
- Repeated runs of the same human alias can collapse into one logical entity and hide retries or parallelism.
- Model analytics will mix explicit model choices with guessed labels.
- Documentation drift will keep reintroducing the same ambiguity in future features.

## Proposed Normalized Taxonomy

The dashboard should explicitly separate these concepts.

| Concept | Proposed normalized fields | Meaning | Notes |
| --- | --- | --- | --- |
| Dispatch mechanism | `dispatch.toolName`, `dispatch.family`, `dispatch.toolCallId` | Concrete tool surface such as `task`, `read_agent`, `task_complete` | `toolCallId` is the primary per-dispatch correlation key |
| Runtime agent target | `agent.targetName`, `agent.targetKind` | Built-in or custom agent selected to do work | Examples: `explore`, `general-purpose`, `code-review`, custom agent name |
| Agent instance identity | `agent.instanceId` | Human-readable worker or alias identity when present | Useful for UI grouping, not a replacement for `toolCallId` |
| Display label | `agent.displayName`, `agent.description` | UI-facing label and summary text | Never use as primary analytics join keys |
| Model | `model.name`, `model.source` | Effective model and where it came from | Example sources: dispatch override, custom-agent default, session fallback, inferred |
| Runtime linkage | `agent.sessionId`, `agent.sessionIdSource` | Optional session linkage if present in raw events | Must stay explicitly empirical until revalidated |
| Status | `status.scope`, `status.kind`, `status.sourceEvent` | Distinguishes session state, dispatch state, and worker state | Prevents `task_complete` from masquerading as agent identity |

## Current Field-to-Taxonomy Mapping

This table is the practical bridge from today's repo types to the normalized taxonomy above.

| Current field | Current overloaded meaning | Normalized destination |
| --- | --- | --- |
| `ActiveSubAgent.toolCallId` | Per-dispatch correlation key | `dispatch.toolCallId` |
| `ActiveSubAgent.agentName` | Runtime agent target in some cases, dispatch tool name in others | split into `dispatch.toolName` and `agent.targetName` |
| `ActiveSubAgent.agentId` | Human alias, derived grouping key, synthetic fallback | `agent.instanceId` |
| `ActiveSubAgent.agentDisplayName` | UI label | `agent.displayName` |
| `ActiveSubAgent.description` | UI summary or task summary | `agent.description` |
| `ActiveSubAgent.isCompleted` | Worker completion mixed with dispatch semantics | `status.scope` + `status.kind` + `status.sourceEvent` |
| `ActiveSubAgent.sessionId` | Optional worker/session linkage with unclear contract | `agent.sessionId` + `agent.sessionIdSource` |
| `ActiveSubAgent.model` | Model when available, without provenance | `model.name` + `model.source` |
| `WorkflowNode.type` | Node kind | keep as node kind |
| `WorkflowNode.label` | Display label, alias, sometimes identity stand-in | `agent.displayName` or node label only |
| `WorkflowNode.agentName` | Comment says tool name, implementation uses human/custom agent name | split into `dispatch.toolName` and `agent.displayName` or `agent.instanceId` |
| `WorkflowNode.agentType` | Mix of orchestrator marker, heuristic category, or tool category | `agent.targetName` / `agent.targetKind` or explicit tool family field |
| `WorkflowNode.model` | Explicit or inferred model without provenance | `model.name` + `model.source` |
| `WorkflowNode.metadata.toolName` | Hidden actual dispatch tool name | promote to `dispatch.toolName` |
| `WorkflowNode.metadata.toolCallId` | Hidden dispatch correlation key | promote to `dispatch.toolCallId` |

### Taxonomy Rules

- Use `dispatch.toolCallId` as the canonical correlation key for one dispatch.
- Use `agent.targetName` for agent-type analytics and filters.
- Use `agent.instanceId` only for worker-alias grouping when that is intentionally desired.
- Keep `displayName` and `description` as presentation fields, not identity fields.
- Keep `model.source` so inferred values can never be mistaken for authoritative values.

## Expected Semantics by Surface

### `ActiveSubAgent`

`ActiveSubAgent` should represent a normalized worker/dispatch view, not a bag of overloaded labels. It needs enough structure to answer these questions independently:

- Which tool dispatched or managed this worker?
- Which runtime agent target did that dispatch select?
- What human alias or instance name was shown to the user?
- What is the authoritative per-dispatch correlation key?
- Is the completion state describing the session, the tool call, or the worker?

### `WorkflowNode`

`WorkflowNode` should not rely on `label` or `agentName` to carry multiple meanings. The topology layer should be able to render a node with:

- node kind
- dispatch mechanism
- runtime agent target
- human-facing display label
- model and provenance
- explicit fallback markers when authoritative fields were unavailable

Topology-specific rule:

- `agent-management` family tools such as `task`, `read_agent`, and `list_agents` remain `tool-call` nodes.
- `sub-agent` nodes represent actual background workers only.
- detached shell sessions are a separate node kind from both ordinary shell tool calls and background subagents.

### Filters

The dashboard should support distinct filter dimensions instead of deriving everything from a single string field:

- tool family filter
- dispatch tool filter
- runtime agent target filter
- worker alias filter
- model filter
- status scope filter

## Workflow Topology Plan

The workflow topology surface should use the normalized taxonomy above as its rendering contract.

### Node Types

- `user-prompt` for the initiating request
- `main-agent` for the orchestrator turn
- `tool-call` for concrete tool invocations, including `agent-management` tools such as `task`, `read_agent`, and `list_agents`
- `sub-agent` for actual background worker lifecycle, not for the management tool that created or queried it
- `detached-shell` for persistent or detached shell-session lifecycle
- `result` for the terminal synthesis/output node

### Classification Rules

- `task`, `read_agent`, `list_agents`, and `task_complete` remain `tool-call` nodes.
- `sub-agent` nodes are emitted only when worker lifecycle evidence exists, such as `subagent.started`, `subagent.completed`, `agent_completed`, or `agent_idle` style background-worker signals.
- one-shot `bash` / `powershell` execution remains `tool-call`.
- shell-session helper surfaces such as `read_*`, `write_*`, `stop_*`, and `list_*`, plus detached-shell notifications, should map to `detached-shell` when they refer to a persistent shell session rather than a one-shot command.

### Round Structure

Each topology round should read as:

`Main Agent -> Tool Calls / Background Workers / Detached Shells -> Main Agent`

That means the graph should:

- emit `tool-call` nodes for the concrete requests in each assistant turn
- add `sub-agent` nodes only when a real background worker lifecycle is observable
- add `detached-shell` nodes only when a persistent shell session is observable
- connect those nodes back to the next main-agent synthesis step or final result

### Layout Implications

- The main agent sits in the primary lane for each round.
- Response nodes for the round sit in a secondary lane beneath or beside the orchestrator.
- The visual structure must make it obvious that a `task` tool-call node and the later background worker node are different objects, even when they are related.

### Filter Implications

- `Sub-agents only` shows only `sub-agent` nodes.
- dispatch-family filters continue to apply to `tool-call` nodes, including `agent-management`.
- detached shell sessions should be independently filterable from ordinary shell tool calls.

## Validation Scenarios

Any future implementation should be validated against representative session traces that include:

1. `task` dispatch to a built-in agent target such as `explore`.
2. `task` dispatch to a custom agent target.
3. Two separate dispatches that reuse the same human alias.
4. `read_agent` flows that do not emit `subagent.started` in the same way as `task`.
5. `task_complete` and `session.task_complete` events appearing in the same session without being counted as sub-agent identities.
6. Compacted sessions that require fallback matching.
7. Cases where model is explicit vs inherited vs inferred.
8. Workflows that heavily use subagents for exploration and editing so filter semantics reflect real usage patterns in this dashboard.
9. Detached shell sessions that use shell-session helper tools or detached-shell notifications.

## Requirements

- [ ] Separate dispatch-tool data from runtime-agent-target data in the dashboard model.
- [ ] Stop representing `task_complete` as a sub-agent identity or agent-type bucket.
- [ ] Represent `read_agent` explicitly as a `tool-call` node in topology and analytics instead of dropping or promoting it to `sub-agent`.
- [ ] Preserve `toolCallId` as the authoritative per-dispatch correlation key.
- [ ] Preserve model provenance so inferred models are distinguishable from explicit ones.
- [ ] Mark any sub-agent `sessionId` field as empirical/optional until revalidated.
- [ ] Represent detached shell sessions as a distinct workflow-node kind rather than folding them into generic shell or sub-agent nodes.
- [ ] Update local reference documentation with a normalized glossary for tool family vs agent target vs worker alias.

## Acceptance Criteria

- [ ] The dashboard data model can answer, independently, which tool dispatched work and which runtime agent target performed it.
- [ ] A filter on runtime agent target does not mix `task`, `read_agent`, or `task_complete` into the same bucket as built-in/custom agent targets.
- [ ] A filter on dispatch tool does not depend on display labels or inferred agent categories.
- [ ] Repeated dispatches with the same human-readable alias remain distinguishable by `toolCallId`.
- [ ] `read_agent` appears in topology and analytics as an explicit `tool-call` node with `agent-management` semantics.
- [ ] Actual background workers appear as `sub-agent` nodes only when worker lifecycle evidence exists.
- [ ] Detached shell sessions appear as their own workflow-node kind with a meaning distinct from ordinary shell commands.
- [ ] Workflow rounds render as `Main Agent -> Tool Calls / Background Workers / Detached Shells -> Main Agent` rather than flattening all response nodes into one generic sub-agent layer.
- [ ] `Sub-agents only` shows only actual background-worker nodes.
- [ ] Dispatch-family filters continue to work on `tool-call` nodes, including `agent-management`.
- [ ] Session completion state and worker completion state are independently queryable and visually distinguishable.
- [ ] Any inferred `agentType` or `model` values are marked as fallbacks, not indistinguishable from authoritative fields.
- [ ] The local session-state docs describe the normalized glossary clearly enough that future features reuse the same semantics.

## Open Questions

- Should the normalized model be introduced alongside the current fields first, or as a breaking rename?
- Do fresh raw traces still emit `sessionId` on `subagent.started`, and if so, what does that field mean in current Copilot CLI builds?
- Should `agent.targetKind` distinguish `built-in`, `custom`, `orchestrator`, and `unknown`, or should the orchestrator remain outside the sub-agent taxonomy entirely?
- How should the topology visually connect a `task` tool-call node to the later `sub-agent` worker node it created when both are present?
- What is the cleanest correlation model between a detached shell node and the follow-up shell-session helper calls that operate on it?

## References

- [server/src/sessionReader.ts](../server/src/sessionReader.ts)
- [server/src/sessionTypes.ts](../server/src/sessionTypes.ts)
- [client/src/api/client.ts](../client/src/api/client.ts)
- [client/src/components/SessionDetail/WorkflowTopologyView.tsx](../client/src/components/SessionDetail/WorkflowTopologyView.tsx)
- [.docs/reference/session-state/session-data-model.md](../.docs/reference/session-state/session-data-model.md)
- [AGENTS.md](../AGENTS.md)

External reference workspace used for this critique:

- `C:\Workplace\Agents\github-copilot-fc\.docs\reference\copilot\cli\copilot-cli-session-state-schema.md`
- `C:\Workplace\Agents\github-copilot-fc\.docs\reference\copilot\cli\fleet-and-task-subagent-dispatch.md`
- `C:\Workplace\Agents\github-copilot-fc\.docs\explanation\copilot\cli\copilot-cli-session-topology.md`
- `C:\Workplace\Agents\github-copilot-fc\tools\inventory.md`

## Related Issues

- [260407_session-detail-workflow-topology-diagram-tab.md](260407_session-detail-workflow-topology-diagram-tab.md)
- [260405_desktop-session-detail-subagent-threads-recency-sorted-list.md](260405_desktop-session-detail-subagent-threads-recency-sorted-list.md)