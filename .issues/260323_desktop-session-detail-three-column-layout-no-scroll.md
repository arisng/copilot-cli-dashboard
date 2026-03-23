---
title: "Desktop Session Detail: enforce three-column viewport layout + restore missing status filter value"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-23"
priority: "High"
---

## Summary

Refine desktop Session Detail UX to match the new design vision for a horizontal three-column dashboard in one viewport. The goal is to keep session detail, top-level navigation, and list browsing in the initial browser viewport, with no page-level vertical scrolling required.

Also fix a missing `working` status option in session status filters across the list and detail contexts.

## Background

Current desktop Session Detail UIs may rely on vertical scroll and have less clear separation between core areas. The requested redesign is a direct follow-up to the earlier 260323 desktop session UX improvements and should be implemented as part of the same surface area.

## Requirements

1. Layout (desktop, initial browser viewport only)
   - Present 3 side-by-side columns within initial viewport (no body-level scroll):
     - Column 1: session overview (title, status, last activity, metadata, summary, attention state)
     - Column 2: vertical `SessionDetailTab` navigation (main agent, subagents, artifacts like plan.md, checkpoints, research files)
     - Column 3: project-scoped sessions list, including filters and sort-order controls for current project
   - Ensure layout works at standard desktop widths (e.g., 1440px) and gracefully collapses in a responsive manner.
   - Keep all columns visible with no page-level scroll; inner column scroll areas are permitted if needed.

2. SessionDetailTab (vertical tab panel)
   - Vertical tabs for main agent, subagents, and artifacts.
   - Clear active state and keyboard navigability.
   - Sustain ARIA semantics and accessible labels.

3. Session List controls (project scope)
   - Add filters and sort controls scoped to the current project context next to/above session list.
   - Ensure `working` is included in status dropdown/filter values, alongside existing statuses.

4. Behavior and QA
   - No uncontrolled vertical page scrolling from the top-level layout.
   - Desktop and mobile should continue to be consistent in semantics and usable across breakpoints.

## Acceptance criteria

- [x] Desktop session detail renders with 3 columns in initial viewport and no body-level scroll.
- [x] Column 1 exposes a full session overview component.
- [x] Column 2 uses vertical tab navigation for agents/subagents/artifacts.
- [x] Column 3 is a session list with project-scoped filters and sort order.
- [x] Status filter includes `working` as an option and correctly applies.
- [x] Accessibility checks pass for focus and ARIA in the vertical tabs.

## Notes

- This issue is scope for UI/layout changes; business logic should remain unchanged unless needed for status filtering.
- Review related desktop UX issue at `.issues/260323_enhance-desktop-session-uxui.md` for prior context.
- Do not implement as a single page that requires a scroll; enforce viewport-constrained columns.

## Resolution

- Reworked the desktop session detail route into a full-width, viewport-constrained three-column grid.
- Kept the overview panel in the left column, the tab rail and tab detail together in the middle column, and the project-scoped session browser in the right column without page-level scrolling.
- Added `Working` to the shared session browse status model so both the main list and detail sidebar can filter active sessions.
- Captured Playwright evidence in `.playwright-cli/screenshots/three-column-layout/`.

## QA Summary

- `npm run build` passed after the layout rewrite.
- Playwright browser testing ran from the repository root and persisted screenshots under `.playwright-cli/screenshots/three-column-layout/`.
- The list screenshot shows the `Working` filter applied to the project-scoped sessions.
- The detail screenshot at `1440x1080` shows the full-width three-column shell with the tab rail and active tab panel sharing the middle column.
- The detail screenshot at `2560x1440` confirms the wider desktop layout still fills the viewport edge-to-edge.
- The Working-filter screenshot confirms the detail sidebar status filter still accepts `Working` and keeps the sidebar list in sync.
- The desktop detail screenshots confirmed `scrollHeight === innerHeight` and `scrollY === 0`.

## Related Wiki

- [About the Desktop Session UX Refresh](../.docs/explanation/dashboard/desktop-session-ux.md)
