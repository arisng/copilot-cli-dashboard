---
title: "Add desktop-only message filters and turn-pair scoping to the Main session view"
type: "Feature"
status: "Completed"
author: "Copilot"
created: "2026-04-04"
priority: "Medium"
---

## Summary

Add on-demand message filtering to the desktop `Main session` tab in Session Detail so users can narrow the root conversation stream without leaving the page or scanning the full transcript manually.

The filtering model should support multi-select facets where appropriate and focus on the desktop main-thread conversation only, not sub-agent threads. At minimum, the user should be able to filter by chat participant, tool call usage, thinking/reasoning state, error presence, relative time window, and a specific user-to-agent turn pair. Mobile behavior is out of scope for this issue.

## Problem Statement

- The current `Main session` panel renders the full `messages` array in chronological order with no message-level filtering.
- Main-thread conversations can become long, especially when the assistant uses many tool calls or alternates between reasoning and tool-heavy turns.
- Users cannot quickly isolate messages from the human participant, the main agent, recent time slices, or only messages that contain errors.
- Users cannot quickly focus one conversation turn, meaning one user input and the complete matching agent response sequence for that turn.
- Tool usage is visible inside each `MessageBubble`, but there is no curated list of tool names used in the main session that can drive targeted filtering.

## Goals

1. Add a desktop-only filter surface to the `Main session` tab that works against root-thread messages only.
2. Support multi-select filters for message participant and tool-call facets.
3. Let users quickly narrow the transcript to recent activity using relative datetime windows such as `Last 30 minutes` and `Last 24 hours`.
4. Provide a one-click path to isolate messages with errors.
5. Expose a curated tool list derived from actual main-session tool calls so the filter options are relevant to the selected session.
6. Let users scope the transcript to one specific user-input and agent-response turn pair.
7. Keep turn-pair filtering compatible with the other message filters instead of making it a separate mutually exclusive mode.
8. Preserve the current reading experience when no filters are active.

## Proposed Behavior

- Add a filter bar or filter drawer inside the `Main session` panel above the message list.
- Keep filtering scoped to `session.messages` and do not mix in `subAgentMessages`.
- Provide a turn selector that lets the user scope the message list to one conversation turn pair, defined as a user input plus the complete main-agent response sequence for that turn.
- Build turn options from root-thread message metadata, preferably `interactionId`, with a stable fallback based on a user message and the assistant messages that belong to it until the next user turn starts.
- Label each turn option with a short preview of the user input plus a timestamp or ordinal so long sessions remain scannable.
- Provide a participant facet with at least:
  - `User`
  - `Main agent`
  - `Task complete`
- Provide a tool-call facet populated from the distinct `toolRequests[].name` values present across main-session assistant messages.
- Provide message-type and metadata facets for main-agent messages, including:
  - `Has tool call`
  - `Has reasoning / thinking`
  - `Has error`
  - Any additional lightweight metadata already available in the parsed message model that improves filtering without expanding scope unnecessarily
- Provide relative datetime presets such as:
  - `Last 30 minutes`
  - `Last 1 hour`
  - `Last 6 hours`
  - `Last 24 hours`
  - `All time`
- Show active filter chips and a clear-all action so the user can understand and reset the current slice quickly.
- When a turn pair is selected, all other active filters should continue to refine the messages inside that selected turn rather than being reset or ignored.
- The filtered result should preserve the existing message rendering order and continue using the current `MessageBubble` presentation.

## Requirements

- [x] Add message-filter UI to the desktop `Main session` surface in `client/src/components/SessionDetail/SessionDetail.tsx` or a focused child component extracted from it.
- [x] Derive main-session filter options from `session.messages` only, not from sub-agent message collections.
- [x] Derive a turn-pair filter from root-thread messages so users can select one user input plus its corresponding main-agent response sequence.
- [x] Prefer `ParsedMessage.interactionId` to group turn-pair messages when available, with a deterministic fallback for messages that do not carry that identifier.
- [x] Present turn options with readable labels, such as truncated user input plus relative or absolute time context.
- [x] Support multi-select participant filtering so users can combine `User`, `Main agent`, and `Task complete` as needed.
- [x] Support multi-select tool filtering using a deduplicated list of all tool names used in the main session.
- [x] Support a relative datetime filter based on `ParsedMessage.timestamp` with user-friendly presets and a clear fallback to `All time`.
- [x] Support an `Errors only` filter that matches any message containing at least one tool error and, if applicable, any other message-level error state already represented in the parsed data.
- [x] Support a reasoning/thinking filter for assistant messages using existing parsed metadata such as `reasoning`.
- [x] Define a minimal, explicit filter-state model so different facets can compose predictably rather than overwriting one another.
- [x] Ensure the turn-pair filter composes with participant, tool, time, reasoning, and error filters instead of replacing them.
- [x] Ensure the filter UI exposes current selection counts or chips so users can see when a narrowed view is active.
- [x] Preserve accessibility: keyboard-operable controls, visible focus states, and labels that clearly distinguish participant, tool, time, and error filters.
- [x] Add or update tests for filter derivation and message filtering behavior.

## Acceptance Criteria

- [x] The desktop `Main session` tab includes a visible message-filter control set.
- [x] Users can scope the desktop `Main session` view to a single user-input and agent-response turn pair.
- [x] Users can filter the main session by participant with multi-select behavior.
- [x] Users can filter the main session by one or more tool names from a curated session-specific tool list.
- [x] Users can filter the main session by relative datetime presets including `Last 30 minutes` and `Last 24 hours`.
- [x] Users can isolate messages with errors in one step.
- [x] Users can isolate assistant messages that contain reasoning / thinking metadata.
- [x] Multiple filters, including turn-pair selection, can be combined at the same time and the results update deterministically.
- [x] Clearing filters returns the full main-session transcript with the existing render order unchanged.
- [x] No sub-agent messages appear in this filtered view unless the user switches to the separate sub-agent threads view.

## Implementation Notes

- Current main-thread rendering is driven by `session.messages` in `client/src/components/SessionDetail/SessionDetail.tsx`, which today maps directly to `MessageBubble` with no filter layer.
- `client/src/api/client.ts` already exposes message fields useful for a first pass of client-side filtering: `role`, `timestamp`, `reasoning`, `toolRequests`, and `interactionId`.
- `server/src/sessionReader.ts` currently builds main-thread messages from root events and attaches tool execution results and errors to `toolRequests`, which should be sufficient for an initial `Errors only` and tool-name filter.
- `server/src/sessionReader.ts` already maps `interactionId` onto root user and assistant messages, which provides a grounded starting point for turn-pair derivation in the desktop UI.
- If the UI needs richer metadata than the current `ParsedMessage` shape provides, extend the parser and shared types deliberately rather than inferring unstable state from rendered content.
- Keep this issue focused on the desktop `Main session` transcript view; sub-agent thread filtering can remain independent.
- Mobile session detail does not need matching filter controls as part of this issue.

## References

- `client/src/components/SessionDetail/SessionDetail.tsx`
- `client/src/components/SessionDetail/MessageBubble.tsx`
- `client/src/api/client.ts`
- `server/src/sessionReader.ts`