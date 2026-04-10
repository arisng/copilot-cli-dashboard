---
title: "Session Detail workflow filters: dynamic agent types and cross-tab consistency"
type: "Task"
status: "Done"
author: "GitHub Copilot"
created: "2026-04-10"
priority: "High"
description: "Replace WorkflowTopologyView's hard-coded agent filter options with data-derived values, align Main session, Sub-agent threads, and Workflow against the same session data, and only retain orchestrator nodes that participate in filtered workflow paths."
---

# Session Detail workflow filters: dynamic agent types and cross-tab consistency

## Summary

Follow up the normalized workflow-topology RFC by tightening the `Workflow` tab so its filters and rendered nodes stay consistent with `Main session` and `Sub-agent threads`.

These three tabs are all derived from the same session event stream and correlated by `toolCallId`, so they should not disagree on which sub-agents, tools, or orchestrator paths exist for a given session or turn.

## Problem Statement

- `WorkflowTopologyView` still uses a hard-coded `AVAILABLE_AGENT_TYPES` list instead of deriving the filter options from the sub-agents that are actually present in the current workflow/session data.
- The workflow filter labels are currently `Agent` and `Family`, even though the normalized taxonomy now distinguishes runtime `Agent Type` from `Tool Family`.
- `Main session`, `Sub-agent threads`, and `Workflow` consume different slices of the same session payload: `messages`, `activeSubAgents`, and `subAgentMessages`.
- `Main session` already derives turn and tool filters from the current message set via `buildTurnOptions`, `getMessageTools`, and `applyMessageFilters`, while `Workflow` computes a separate filter surface from graph nodes.
- `Sub-agent threads` reads `session.subAgentMessages[toolCallId]`, while `Workflow` upgrades matching graph nodes from `session.activeSubAgents`; if those joins or filters drift, the two tabs can show different sub-agent inventories for the same session.
- The workflow filter implementation currently keeps all core nodes, including every `main-agent` node, when `Agent Type` or tool-related filters are active. That leaves unrelated `Orchestrator` nodes visible even when they are not connected to the matching filtered results.

## Goals

1. Replace the workflow agent filter's fixed option list with the distinct agent types that are actually present in the current workflow/session data.
2. Rename the workflow filter labels from `Agent` to `Agent Type` and from `Family` to `Tool Family`.
3. Make `Main session`, `Sub-agent threads`, and `Workflow` agree on the same underlying set of sub-agents, tool calls, and turn-scoped data for a given session.
4. Align workflow filtering behavior with the existing message/tool filtering semantics used in `Main session` wherever the filter dimensions refer to the same data.
5. When an `Agent Type` or tool-related filter is active in `Workflow`, retain only the `Orchestrator` nodes that participate in the paths for matching filtered nodes.

## Requirements

- In `WorkflowTopologyView`, derive available `Agent Type` filter chips from the distinct normalized agent targets or sub-agent types present in the current workflow data instead of the static `AVAILABLE_AGENT_TYPES` constant.
- Rename the workflow filter labels as follows:
  - `Agent` -> `Agent Type`
  - `Family` -> `Tool Family`
- Derive available `Tool Family` values from the current graph/session data when practical so the workflow filter surface only shows values that are actually present in the selected turn/workflow.
- If `Workflow` exposes exact tool-name filtering in addition to `Tool Family`, derive those tool options from the same message/tool-request inventory used by `Main session` instead of from graph-label heuristics.
- The workflow filter dimensions must be backed by the same normalized session data used by the rest of Session Detail, not by display-label heuristics alone.
- For any sub-agent thread that appears in `Sub-agent threads`, the corresponding `toolCallId` must be representable in `Workflow`; for any workflow node enriched from `activeSubAgents`, there should be matching thread/message data when `subAgentMessages` exists for that `toolCallId`.
- `Main session` and `Workflow` must agree on turn scoping and tool visibility for the same session context. A tool or sub-agent visible under one view's filters should not be silently invented or omitted by the other view when they are reading the same underlying turn data.
- When an `Agent Type` filter is active in `Workflow`, keep only:
  - matching workflow nodes
  - the edges needed to connect those matches
  - the `Orchestrator` nodes associated with those matches
- When a specific tool filter or `Tool Family` filter is active in `Workflow`, apply the same path-preserving rule so unrelated `Orchestrator` nodes are removed from the filtered graph.
- Preserve the normalized taxonomy from the parent RFC: `Tool Family` and runtime `Agent Type` remain separate dimensions and should not collapse back into one overloaded label field.

## Acceptance Criteria

- The workflow filter chips show only agent types that are actually present in the current workflow/session data.
- The workflow filter labels read `Agent Type` and `Tool Family`.
- A session that exposes a thread in `Sub-agent threads` also exposes the same sub-agent/tool-call identity in `Workflow` when applicable, using the same `toolCallId` correlation.
- The visible set of tools and sub-agents for a selected turn stays consistent between `Main session` and `Workflow`.
- The visible set of sub-agent identities stays consistent between `Sub-agent threads` and `Workflow`.
- Filtering by `Agent Type`, a specific tool, or `Tool Family` no longer leaves unrelated `Orchestrator` nodes in the graph.
- Unfiltered workflow rendering still behaves correctly for sessions with no sub-agents, compacted sessions, and `read_agent`-only activity.

## Notes

- `SessionDetail` currently passes `session.messages` to both `Main session` and `Workflow`, `session.activeSubAgents` to `Workflow`, and `session.subAgentMessages` to `Sub-agent threads`.
- `server/src/sessionReader.ts` builds `activeSubAgents` and `subAgentMessages` from the same `events` array, so cross-tab mismatches are a dashboard consistency bug rather than a separate data-source limitation.
- Keep exact tool-name filtering, if exposed in `Workflow`, additive to `Tool Family` rather than replacing the normalized family dimension.

## References

- [client/src/components/SessionDetail/WorkflowTopologyView.tsx](../client/src/components/SessionDetail/WorkflowTopologyView.tsx)
- [client/src/components/SessionDetail/SessionDetail.tsx](../client/src/components/SessionDetail/SessionDetail.tsx)
- [client/src/utils/messageFilters.ts](../client/src/utils/messageFilters.ts)
- [client/src/api/client.ts](../client/src/api/client.ts)
- [server/src/sessionReader.ts](../server/src/sessionReader.ts)
- [server/src/sessionTypes.ts](../server/src/sessionTypes.ts)

## Related Issues

- [260410_normalize-copilot-cli-subagent-mapping-tool-vs-agent-identity.md](260410_normalize-copilot-cli-subagent-mapping-tool-vs-agent-identity.md)
- [260407_session-detail-workflow-topology-diagram-tab.md](260407_session-detail-workflow-topology-diagram-tab.md)
- [260405_desktop-session-detail-subagent-threads-recency-sorted-list.md](260405_desktop-session-detail-subagent-threads-recency-sorted-list.md)
- [260404_main-session-message-filtering.md](260404_main-session-message-filtering.md)