---
type: Feature Plan
title: Refine mobile session UX/UI against the latest desktop baseline
description: Audit desktop and mobile session UX differences, then rework the mobile experience so it follows the latest desktop baseline without forcing a 1:1 translation.
status: Complete
author: GitHub Copilot
date: 2026-04-05
---

# Refine mobile session UX/UI against the latest desktop baseline

## Summary

The desktop session experience has been refined enough to serve as the current reference design. Mobile should now be reviewed against that baseline to identify where the mobile experience has drifted, where desktop patterns need to be reinterpreted for small screens, and where mobile-specific layouts should intentionally diverge instead of copying desktop behavior directly.

## Problem Statement

- Mobile and desktop share the same product model, but they do not share the same ergonomic constraints, screen density, or interaction expectations.
- Recent desktop refinements should be treated as the baseline for information hierarchy, content priority, and visual rhythm.
- A direct 1:1 translation from desktop to mobile will likely create cramped layouts, hidden actions, and inefficient scrolling on narrow screens.
- The mobile experience needs a deliberate redesign pass that preserves the desktop baseline's intent while adapting the presentation for touch-first usage.

## Goals

1. Audit the current UX/UI differences between mobile and desktop session surfaces.
2. Use the latest desktop design as the source of truth for what information matters most.
3. Recompose mobile layouts so they are mobile-native, not shrunken desktop clones.
4. Preserve the core session workflows while improving readability, tapability, and scanning on small screens.

## Discrepancy Audit

- Compare mobile and desktop session list density, metadata ordering, and status or attention signaling.
- Compare mobile and desktop session detail hierarchy, including headers, tabs, sticky summary areas, and content panes.
- Review artifact surfaces such as markdown, file, image, and sub-agent or thread presentation for desktop-first assumptions that do not scale to mobile.
- Identify which desktop affordances should collapse, stack, pin, or become progressively disclosed on mobile.
- Call out intentional divergences so mobile behavior is documented as a design choice, not treated as drift.

## Requirements

- Treat the latest desktop session UI as the baseline for hierarchy and content priority, but not as a layout template to copy directly.
- Update mobile session surfaces to use mobile-specific spacing, stacking, and control placement where the desktop pattern is too dense or wide.
- Ensure touch targets, scrolling behavior, and viewport fit remain comfortable on narrow screens.
- Keep critical session signals visible without forcing the user to hunt through hidden tabs or nested controls.
- Preserve desktop behavior unless a change is intentionally shared across both experiences.
- Document the mobile decisions that differ from desktop so future refinements do not reintroduce accidental parity.

## Implementation Approach

- Start with a discrepancy matrix covering the main mobile and desktop session surfaces.
- Refine mobile list and detail components first, then any shared renderer pieces only if the mobile audit shows a real parity gap.
- Favor mobile-native patterns such as stacked metadata, compressed summary bars, and simplified navigation when the desktop structure is too wide.
- Use the desktop baseline to judge information priority, not to enforce identical component composition.
- Validate the updated mobile experience at common handset widths and in both scroll-heavy and content-dense sessions.

## Risks

- Copying desktop patterns too literally may reduce legibility and make the mobile experience feel crowded.
- Shared component edits could accidentally alter desktop behavior if mobile-specific branching is not kept explicit.
- Over-optimizing for parity could obscure mobile-only interaction needs such as thumb reach, one-handed use, and reduced horizontal space.

## Acceptance Criteria

- Mobile session list and detail views are visibly aligned with the latest desktop UX direction but remain clearly mobile-native.
- Important session information stays discoverable on narrow screens without needing desktop-style layouts.
- No desktop regressions are introduced by the mobile refinement work.
- The mobile experience is validated at representative phone widths and interaction paths.
- The discrepancy audit results are documented before or alongside implementation so design intent is explicit.

## References

- [Enhance desktop session UX/UI](260323_enhance-desktop-session-uxui.md)
- [Enhance the "Files" tab in session details view in desktop mode](260405_enhance-files-tab.md)
- [Desktop Session Detail Sub-agent threads tab: single recency-sorted list with metadata](260405_desktop-session-detail-subagent-threads-recency-sorted-list.md)
- [Desktop Session Detail column 3: open in new tab, 450px width cap, and wrapped session names](260405_desktop-session-detail-column3-open-new-tab-width-cap-wrapped-names.md)
- [Enhance markdown rendering across desktop and mobile session artifact surfaces](260331_enhance-markdown-rendering-desktop-mobile-surfaces.md)
- [Add collapsible headings and quick section navigation to markdown viewer](260403_markdown-viewer-collapsible-headings-desktop-mobile.md)
- [Mobile session detail sticky summary bar](260403_mobile-session-detail-sticky-summary-bar.md)