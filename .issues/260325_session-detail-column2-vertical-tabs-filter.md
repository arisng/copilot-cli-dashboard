---
title: "Refine Session Detail column 2 vertical tabs into a single filterable panel"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-25"
priority: "Medium"
---

## Summary

In desktop Session Detail view, column 2 currently uses vertical tabs for:
- Main session
- Plan
- Subagent threads

The goal is to consolidate this into a single tab/panel with a filtering control so users can switch content from one place with better UX and consistent single-pane behavior.

## Problem Statement

- Vertical tabs in column 2 take more visual space and can feel fragmented.
- Users need to click separate tabs for main session, plan, and subagent threads, causing context switches.
- With more subagent threads, additional vertical tabs are hard to scan.

## Goals

1. Replace the vertical tab group in column 2 with one primary tab (e.g., "Session Output") that includes a filter selector.
2. Filter options include: `Main session`, `Plan`, `Subagent threads` (+ per-thread item if needed).
3. Keep existing functionality intact (correct render of each content type).
4. Maintain keyboard accessibility, proper ARIA roles, and responsive behavior.

## Requirements

- [ ] Update UI component(s) responsible for Column 2 tabs (e.g., `client/src/components/SessionDetail/SessionTabNav.tsx` and/or related stack components).
- [ ] Remove or hide the vertical tab list for `Main session`, `Plan`, `Subagent threads` in desktop mode.
- [ ] Add a new filter control inside the remaining panel (dropdown/segmented control) that selects which content to show.
- [ ] Ensure `Subagent threads` option can expand or select specific thread context (e.g., nested select, autocomplete, or search).
- [ ] Update state management/hook logic to support the combined panel and preserve previously selected item when toggling modes.
- [ ] Add automated tests for the new filter behavior and fallback states.
- [ ] Update docs or comments to reflect the new column 2 UX pattern.

## Acceptance Criteria

- [ ] Column 2 displays a single top-level tab/panel for session detail content instead of multiple vertical tabs.
- [ ] The filter control has at least these options: `Main session`, `Plan`, `Subagent threads`.
- [ ] Selecting `Subagent threads` allows choosing a specific thread by name.
- [ ] Existing content from each view renders correctly after migration.
- [ ] No regressions in mobile mode or other session detail layouts.

## Notes

- This issue focuses on desktop model column 2 refinement; mobile behavior should remain stable but does not need to switch to this UI pattern.
- If immediate thread search is not in scope, a basic list-of-thread items filter is sufficient with a follow-up task for an improved experience.
