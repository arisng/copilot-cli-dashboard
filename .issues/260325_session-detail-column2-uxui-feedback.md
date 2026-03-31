---
title: "Session Detail column 2 UX/UI feedback: tab rail primacy, artifact filters, and todo-graph session.db"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-25"
priority: "Medium"
---

## Summary

Feedback from the recent desktop Session Detail column 2 UXUI update:
- Users still prefer the tab rail to be the primary navigation in column 2 for inspecting session detail content.
- Users want a filter control to toggle visibility of different artifact types (tabs) rather than an unbounded vertical list.
- Subagent tabs currently dominate the tab set; manage this scale with improved filtering and grouping.
- There is a desire to simplify `session.db` representation into a dependency graph of todo items with per-item metadata.

## Problem Statement

- Column 2 currently surfaces many tabs, especially subagent artifacts, which overwhelms the sidebar and reduces scanability.
- The current UI in desktop mode is not clearly driven from a single primary navigation pattern (tab rail), leading to mental model friction.
- Session data is being displayed as raw artifact tabs rather than as a structured graph of work items and dependencies, causing cognitive load for deep debugging.

## Goals

1. Make the tab rail the primary navigation for column 2 session details in desktop mode.
2. Add a filter control for artifact categories: Main session, Plan, Subagent threads, and any other artifact types.
3. Reduce direct tab count in the UI by collapsing/aggregating subagent tabs and supporting explicit selection within a filtered view.
4. Represent `session.db` information as a todo-item dependency graph with metadata (status, assigned agent, timestamps, outputs).

## Requirements

- [ ] Keep the existing tab names and content modes (Main session, Plan, Subagent) but expose them through a unified rail + filter approach.
- [ ] Implement a filter UI in Column 2 (dropdown, chips, segmented button) to control which artifact categories are visible.
- [ ] Add grouping for subagent tabs and optionally a search input for thread names.
- [ ] Avoid loading all subagent components simultaneously unless selected; preserve performance for sessions with many subagents.
- [ ] Add a new presentation mode for `session.db` as dependency graph view with node metadata and relationship edges.
- [ ] Define a UX path for toggling between artifact-centric view and dependency-graph view.
- [ ] Include keyboard navigation and accessibility checks for the updated controls.
- [ ] Update tests in `client/src/components/SessionDetail` and associated hooks to cover selection/filter behavior.

## Acceptance Criteria

- [ ] Desktop session detail column 2 uses a tab rail as primary navigation for detail modes.
- [ ] A visible filter control can show/hide artifact categories, including subagent-heavy lists.
- [ ] Subagent tabs are grouped and scalable (collapsible group or nested select) with a reasonable default selection.
- [ ] The `session.db` inspection can be toggled into a todo-item dependency graph with metadata nodes (at minimum prototype state).
- [ ] New behavior has unit tests and no regressions in existing session detail scenarios.

## Notes

- This issue is primarily UX/UI in desktop mode but should not break mobile session detail flows.
- The todo dependency graph is a higher-level feature request; a first iteration can be a read-only renderer overlay.
- If there is already a partially related issue in `.issues` (e.g., `session-detail-column2-vertical-tabs-filter.md`), this item can serve as follow-up refinements and acceptance consolidation.
