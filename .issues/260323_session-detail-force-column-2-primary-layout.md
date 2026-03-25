---
title: "Desktop session detail 3-column layout: make center column primary"
type: "Feature/UX"
status: "Open"
author: "Copilot"
created: "2026-03-23"
priority: "High"
---

## Summary

In desktop Session Detail view, the 3-column layout currently treats all columns similarly, which makes the detailed session content in column 2 feel cramped. Column 2 must be redesigned to occupy the majority of the viewport in desktop mode, while columns 1 and 3 act as sidebars with minimal width.

## Problem Statement

- Current desktop 3-column layout gives too much width to column 1 and column 3.
- Column 2 (current session details and chat content) does not get top priority and suffers from limited real estate.
- Sidebars (column 1 and column 3) demand more space than necessary, which reduces clarity and readability for the main content.

## Goals

1. In desktop mode Session Detail view, set column 2 as the largest viewport area.
2. Reduce column 1 and column 3 width to sidebar behavior while preserving their content visibility.
3. Keep overall layout consistent across standard desktop breakpoints (1280px+, 1440p, 1920p).
4. Ensure no horizontal scrolling from too-narrow central content.

## Requirements

- [ ] Update desktop 3-column CSS/layout to set flex basis or width so central column growth is prioritized.
- [ ] Ensure column 1 and column 3 maintain a fixed or min-width suitable for sidebar content (e.g., 240px-320px) and should not push column 2 below usability thresholds.
- [ ] Allow column 2 to consume remaining available width and grow on wide screens.
- [ ] Keep column-1/session navigation + column-3/auxiliary details accessible, but not dominating.
- [ ] Validate both desktop-only `SessionDetail` layout and possible shared components with mobile to avoid regressions.

## Acceptance Criteria

- [ ] Desktop session detail uses a 3-column layout where column 2 is the largest area.
- [ ] Column 1 and column 3 are visually sidebars and do not exceed specified sidebar max width.
- [ ] Central column has enough width for detailed session data and message list without excessive wrapping.
- [ ] Layout is stable for 1280x720, 1440x900, and 1920x1080.
- [ ] Existing features continue to work (e.g., session switching, metadata links, details panel, actions).

## Notes

- This is a UI/UX enhancement and should be validated with real user tests in desktop mode.
- If there is an existing `grid-template-columns` or `flex` configuration in `client/src/components/SessionDetail`, update it accordingly and keep the code maintainable.
