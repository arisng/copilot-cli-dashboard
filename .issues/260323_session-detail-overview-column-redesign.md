---
title: "Redesign desktop Session Detail 'Session Overview' column (column 1)"
type: "Bug/Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-23"
resolved: "2026-03-24"
priority: "High"
---

## Summary

In desktop session detail view, the leftmost column (current "Session Overview") is broken and unresponsive. Existing component structure should be replaced with a new layout; the column should show a clear Overview section and properly stack main child components vertically in desktop mode.

## Problem Statement

- Current layout in desktop Session Detail is “completely broken and unresponsive.”
- Column 1 (Session Overview) does not render consistently across breakpoints.
- Child components are in incorrect allocation order and orientation, causing poor hierarchy and usability.
- Session title font size is not compact/readable relative to other text.

## Goals

1. Rebuild column 1 in Session Detail view from scratch, not by patching the existing component tree.
2. Reserve a dedicated Overview panel area containing:
   - Session title (adjusted font size for proper emphasis and spacing)
   - Session status, metadata, and key stats (last activity, records, size, tags)
   - Attention indicators and critical warnings
3. Stack main child components vertically in the left column (do not use existing broken horizontal or grid arrangement).
4. Ensure responsive behavior at 1280x720, 1440p, and 1920p in desktop mode.
5. Keep right-side detail content (chat logs, tabs, guards) responsive and avoid overflow focus issues.

## Requirements

- [ ] Replace existing `SessionOverview` or similar component and rebuild with robust layout primitives.
- [ ] Adjust session title typography (increase font-size slightly; if previously too small, use 24px/1.5rem; otherwise set to 20px/1.25rem depending on design tokens).
- [ ] Use vertical stacking (column flex direction) for overview elements.
- [ ] Provide clear gap/padding between blocks (12-16px) and avoid absolute widths that break at narrow/wide sizes.
- [ ] Ensure keyboard and screen reader accessibility for focusable elements in the column.
- [ ] Keep current functionality (click details, open metadata, navigation) intact.

## Acceptance Criteria

- [ ] Desktop Session Detail view has an intact, usable Column 1 Overview panel.
- [ ] Session title renders with updated font size in all desktop breakpoints.
- [ ] Child components in column 1 are vertically stacked and do not overlap.
- [ ] Layout no longer breaks at typical desktop widths; test 1280x720 and 1920x1080.
- [ ] Existing features that rely on overview data remain fully functional.

## Notes

- Do not preserve old flawed component structure; implement with new layout code and refactor as needed.
- Validate against existing `client/src/components/SessionDetail` roots and mobile mode style parity.
- This issue is a user-facing UX bug and should be prioritized for the next desktop polish sprint.
