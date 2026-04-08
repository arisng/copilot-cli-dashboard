---
type: Feature Plan
title: Add a workflow topology diagram tab to Session Detail
description: Visualize how a specific turn is resolved as a node-based workflow diagram in a minimal canvas playground.
status: Completed
author: GitHub Copilot
date: 2026-04-07
priority: Medium
---

# Add a workflow topology diagram tab to Session Detail

## Summary

Add a new tab to the Session Detail tabs rail that visualizes how a specific turn was resolved from the user's prompt through agent activity and tool calls to the final result.

The diagram should be node-based, with nodes representing agents and tool calls plus the start and end points of the turn. The view should be rendered in a canvas-style playground with minimal controls for inspection.

## Problem Statement

- The current Session Detail view is good for reading messages, but it is difficult to understand the execution topology of a turn at a glance.
- Users need to see which agents participated, which tools were called, and how the workflow progressed from prompt to result.
- Raw event inspection is slower than a visual topology when the goal is to understand how a turn unfolded.

## Goals

1. Add a new tab in the Session Detail tabs rail for workflow topology.
2. Visualize a specific turn as a directed node graph.
3. Show the user's prompt as the start node and the final result as the terminal node.
4. Represent agent nodes with relevant metadata such as `agent_id`, `agent_type`, and a short task summary.
5. Represent tool call nodes with relevant tool metadata and relationship context.
6. Render the diagram in a canvas playground with only minimal viewer tools.

## Proposed UX

- The new tab should sit alongside the existing Session Detail tabs and open the workflow topology for the currently selected turn.
- The diagram should feel read-only and explanatory, not like a diagram editor.
- Viewer controls should stay minimal, likely limited to pan, zoom, and node inspection.
- The graph should make the execution path understandable without requiring the user to read the full event stream.

## Requirements

- [x] Add a new Session Detail tab and panel for workflow topology.
- [x] Define how the view selects the specific turn to visualize.
- [x] Build a node model for user prompts, agents, tool calls, and the final result.
- [x] Attach agent metadata including `agent_id`, `agent_type`, and task summary where available.
- [x] Attach tool metadata where available, including the call relationship to the surrounding workflow.
- [x] Render the graph in a canvas-based viewer with minimal controls.
- [x] Keep the tab consistent with existing Session Detail layout behavior.
- [x] Handle missing or partial data gracefully with a clear empty state.
- [x] Add test coverage or fixture data for at least one representative turn.

## Acceptance Criteria

- [x] A new tab appears in Session Detail without breaking the existing tab rail.
- [x] The tab renders a node-based workflow diagram for a specific turn.
- [x] The diagram starts with the user's prompt and ends with the final result.
- [x] Agent and tool nodes display the requested metadata when available.
- [x] The viewer is lightweight and does not expose unnecessary editing affordances.
- [x] Partial data or missing metadata degrades gracefully.

## Open Questions

- Should the tab always show the currently selected turn, or should it allow browsing between turns?
- Should the diagram be desktop-only, or should mobile get a simplified fallback?
- Which canvas or graph rendering approach should be used for the initial implementation?
- Should the view include only agent/tool execution, or also hook and lifecycle events if they affect the topology?
