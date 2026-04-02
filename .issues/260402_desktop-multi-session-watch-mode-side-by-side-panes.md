---
title: "Desktop multi-session watch mode: side-by-side session panes"
type: "Feature"
status: "Implemented"
author: "Copilot"
created: "2026-04-02"
priority: "Medium"
---

## Summary

Enable a desktop watch mode where users can bulk-select multiple sessions from the session list and view them side by side in one viewport. Each selected session should render using the existing mobile session shell so the desktop layout can scale horizontally while preserving the compact mobile session experience.

## Problem Statement

The current desktop experience is optimized for inspecting one session at a time. Users who want to monitor several sessions in parallel have to switch back and forth, which makes comparison and live watching inefficient. The existing mobile session layout already provides a compact per-session container, but it is only exposed through mobile routes today.

## Goals

1. Allow bulk selection of sessions directly from the desktop session list.
2. Render selected sessions as side-by-side panes in a single desktop viewport.
3. Reuse the mobile session layout as the per-session content container instead of creating a second desktop-specific session shell.
4. Constrain the number of visible panes by available viewport width rather than by an unbounded selection list.
5. Preserve the existing single-session desktop and mobile experiences.

## Proposed behavior

- A user can select multiple sessions from the desktop list and open them into a multi-watch workspace.
- Each selected session appears as an independently updating pane.
- The visible pane count should be derived from available desktop width divided by the standard mobile-pane width, with a practical minimum width and a hard cap based on the actual viewport.
- When more sessions are selected than can fit, the UI should degrade gracefully through overflow handling rather than breaking layout.
- The mobile session layout should remain the inner rendering unit for one session pane, so the multi-watch view is mostly orchestration and composition rather than a new detail renderer.

## Requirements

1. Bulk selection
   - Add multi-select controls to the desktop session list.
   - Support selecting and deselecting sessions without losing browse context.
   - Show selection count and a clear-selection action.

2. Multi-pane layout
   - Show selected sessions side by side in a single desktop viewport.
   - Reuse the mobile session container for each pane.
   - Keep pane chrome minimal so the session content remains readable at narrow widths.

3. Width-based pane limit
   - Compute the maximum visible pane count from the current desktop viewport width divided by a standard mobile width baseline.
   - Apply a practical minimum and maximum so the layout remains usable at common desktop sizes.
   - Handle overflowed selections with a predictable fallback such as horizontal scrolling, paging, or a collapsed overflow tray.

4. Live updates
   - Each pane should continue using the existing session polling and caching behavior.
   - One pane updating must not reset or disrupt the other panes.

5. Responsive behavior
   - Below the desktop threshold, fall back to the existing single-session experience.
   - Do not change the existing mobile route semantics unless needed for reuse.

6. Accessibility
   - Selection controls and pane switching must be keyboard accessible.
   - Provide clear labels for selected sessions and active panes.
   - Preserve readable focus states and ARIA semantics.

## Acceptance criteria

- [x] Desktop users can bulk-select more than one session from the list.
- [x] Selected sessions render side by side in a single viewport.
- [x] Each pane uses the existing mobile session layout as its inner container.
- [x] The number of simultaneously visible panes is constrained by viewport width and a mobile-width baseline.
- [x] Overflow selections remain accessible without breaking the layout.
- [x] Desktop single-session and all mobile experiences continue to work as before.

## Notes

- Likely implementation surfaces: `client/src/App.tsx`, `client/src/components/SessionList/`, `client/src/components/mobile/`, and the shared session polling hooks.
- This issue is intentionally about UI composition and viewport management, not new backend session data.
- Open question: should overflowed selections be scrolled, paged, or summarized in a tray?
