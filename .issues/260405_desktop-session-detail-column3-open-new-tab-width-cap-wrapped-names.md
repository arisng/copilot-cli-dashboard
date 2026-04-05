---
title: "Desktop Session Detail column 3: open in new tab, 450px width cap, and wrapped session names"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-04-05"
priority: "Medium"
---

## Summary

Refine the desktop Session Detail third column, which shows other sessions in the same workspace, so it behaves like a polished secondary browser pane rather than a cramped overflow list. The column should stop growing past 450px, support right-click actions to open a session in a new browser tab, and make long session names easier to scan.

## Problem Statement

- The workspace-session list in column 3 is part of the core desktop detail workflow, but long titles can collapse readability.
- The column can expand beyond an ideal sidebar width, which steals space from the main detail content and makes the layout feel unbalanced.
- There is no explicit context-menu path for opening a peer session in a new tab from the column 3 list.
- Session names that overflow are harder to compare when only a truncated single line is visible.

## Goals

1. Treat column 3 as a constrained sidebar list for other sessions in the same workspace.
2. Cap the visible column width at 450px in desktop Session Detail.
3. Add a right-click context menu action that opens the selected session in a new browser tab.
4. Allow session names to wrap to two lines so longer names remain readable.
5. Show the full session name on hover when the visible text is truncated.

## Requirements

- The change applies only to desktop Session Detail when column 3 is visible.
- Column 3 must not exceed `450px` width.
- The session list item title should be allowed to occupy up to two lines before truncation.
- Hovering an item with a truncated title should reveal the full session name via tooltip or an equivalent accessible mechanism.
- Right-clicking a list item should expose an "Open in new tab" action.
- Selecting the action should open that session's detail route in a separate browser tab without disrupting the current view.
- Existing left-click selection and navigation behavior should remain unchanged.
- The solution should preserve keyboard and screen-reader accessibility as much as the surrounding UI allows.

## Acceptance Criteria

- Column 3 never exceeds 450px on desktop when visible.
- Right-click on a session row in column 3 exposes an "Open in new tab" action.
- Choosing that action opens the selected session in a new browser tab.
- Session names can wrap to two lines instead of being forced into a single-line truncation.
- Hovering a truncated session name reveals the full name.
- The current desktop Session Detail layout still behaves correctly at common widths and does not introduce horizontal overflow.
- Mobile Session Detail behavior is unchanged.

## Notes

- This is a follow-up refinement to the desktop three-column Session Detail work.
- The implementation should prefer a local context menu or row-level menu pattern that matches the existing app style.
- If the row text already uses truncation utilities, preserve the two-line behavior only for this list item presentation rather than changing unrelated list components.

## Related Issues

- `.issues/260323_desktop-session-detail-three-column-layout-no-scroll.md`
- `.issues/260402_session-detail-column1-cap-500px-column2-fill-remaining-space.md`
- `.issues/260323_session-detail-force-column-2-primary-layout.md`
