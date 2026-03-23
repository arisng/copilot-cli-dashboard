---
title: "Enhance Desktop session UI: Overview panel + responsive detail layout"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-23"
priority: "Medium"
---

## Summary

On desktop, session detail and session list UI currently underuse available viewport space. This feature request brings parity with mobile session UX by adding an "Overview panel" and reworking tab display as a vertical panel in detail view.

## Goals

- Add an "Overview panel" to desktop Session Detail view (same conceptual content as Mobile mode).
- Increase density and clarity of useful information at-a-glance in both Session List and Session Detail views.
- Replace horizontal tab bar in Session Detail with vertical side-nav for main agent / subagents / artifacts for better visibility in limited-height windows.

## User impact

- Faster context scanning for users who monitor multiple sessions on desktop.
- Less vertical scroll penalty and fewer hidden tabs behind overflow controls on narrow window heights.
- Consistent UX analogy between desktop and mobile session workflows.

## Requirements

1. Session List view (desktop)
   - Prioritize meaningful fields in row cards to avoid empty space and low density.
   - Reduce empty whitespace; enlarge/relocate metadata badges, status tags, last activity, and attention indicators.
   - Ensure viewport-first content (top 2-3 rows) surfaces highest-impact session details.

2. Session Detail view (desktop)
   - Add an overview panel near the top of detail view (header or left side) including session title, status, last activity, and high-level metadata (bot, user, prompt summary, attentions).
   - Transform current horizontal tabs (main agent, subagents, artifacts) into vertical navigation (left side) with labels and icons.
   - Keep child-panel content in remaining space and support responsive collapse for narrow width.

3. Session Detail tab mechanics
   - Vertical nav should list up to 8 tabs without overflow scroll wherever possible.
   - Extra tabs should resort into a "More" section or overflow menu (maintain discoverability).
   - Active tab should be visually distinct with support for keyboard navigation & accessible ARIA semantics.

## Acceptance criteria

- [ ] Desktop Session Detail has a visible Overview panel with data overlapping mobile view semantics.
- [ ] Session List default viewport shows more actionable info without requiring scrolling more than 2 rows.
- [ ] Desktop Session detail tab system is vertical and presentable at 1080p and 1440p.
- [ ] No regressions in mobile session views.
- [ ] Automated and manual QA pass for responsiveness, accessibility, and click/keyboard navigation.

## Notes

- The feature is focused on **presentation** not business logic changes.
- Validate with designers if exact card/panel layout should match mobile, or if a desktop optimized variant is preferable.
- Consider integrating with existing shared components in `client/src/components/SessionDetail` and `client/src/components/SessionList`.
