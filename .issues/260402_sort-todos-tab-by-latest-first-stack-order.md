---
title: "Sort Todos tab items by latest first"
type: "Feature"
status: "Closed"
author: "Copilot"
created: "2026-04-02"
priority: "Medium"
---

## Summary

Make the items in the Todos tab display in reverse chronological order so the newest todo appears at the top and the oldest todo settles toward the bottom, matching a stack-like mental model.

## Problem Statement

- The current Todos tab ordering does not clearly emphasize the most recent work item.
- Users reviewing active tasks need the newest todo visible first to match how the list is typically built over time.
- A stack-like ordering makes the tab easier to scan when items are added incrementally.

## Goals

1. Render Todos tab items with the latest todo first.
2. Keep the oldest todo at the bottom of the list.
3. Preserve existing item content, styling, and interactions aside from ordering.

## Requirements

- [ ] Update the Todos tab list rendering logic so items are sorted newest-to-oldest before display.
- [ ] Ensure the order is stable for items with the same timestamp or creation sequence.
- [ ] Keep any upstream data model or persistence format unchanged unless the current implementation requires a view-only sort.
- [ ] Preserve empty-state and loading-state behavior in the Todos tab.
- [ ] Add or update tests covering the ordering rule for new, existing, and mixed-age todo items.

## Acceptance Criteria

- [ ] The top item in the Todos tab is always the most recently created or added todo.
- [ ] Older todo items appear below newer ones in descending order.
- [ ] No other Todos tab behavior regresses as a result of the ordering change.
- [ ] Tests verify the latest-first ordering contract.

## Notes

- Treat this as a display-order requirement for the Todos tab UI.
- If the app already stores todos in chronological order, prefer reversing or sorting at the presentation layer unless there is a strong reason to change the source order.