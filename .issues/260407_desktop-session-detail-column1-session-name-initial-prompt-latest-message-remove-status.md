---
title: "Desktop Session Detail column 1: session name header, initial prompt label, latest message panel, and status cleanup"
type: "Task"
status: "Completed"
author: "Copilot"
created: "2026-04-07"
priority: "Medium"
description: "Refine the desktop Session Detail first column so the session name becomes the heading, Prompt Summary is relabeled as Initial Prompt, Latest Message appears directly after it, and the standalone Status panel is removed."
---

# Desktop Session Detail column 1: session name header, initial prompt label, latest message panel, and status cleanup

## Summary

Recent desktop Session Detail feedback focuses on tightening the first column hierarchy so it reads like a session overview instead of a prompt dump.

## Problem Statement

- The current H1 uses the user prompt, but the desktop detail page needs the session name as the primary title.
- The panel labeled `PROMPT SUMMARY` is better framed as the original input and should read `INITIAL PROMPT`.
- The `LATEST MESSAGE` panel from `Main session` should sit directly below `INITIAL PROMPT` so the current conversation context is immediately visible.
- The standalone `STATUS` panel consumes too much vertical space for the value it provides.

## Goals

1. Make the first column title the session name instead of the user prompt.
2. Rename `PROMPT SUMMARY` to `INITIAL PROMPT`.
3. Surface `LATEST MESSAGE` from `Main session` immediately after the `INITIAL PROMPT` panel.
4. Remove the standalone `STATUS` panel from the desktop first column.
5. Keep the change scoped to desktop Session Detail unless a later follow-up intentionally updates mobile behavior.

## Requirements

- The first column H1 should display the session name.
- The first-column prompt block should be labeled `INITIAL PROMPT`.
- The `LATEST MESSAGE` panel from `Main session` should appear immediately after `INITIAL PROMPT`.
- The standalone `STATUS` panel should be removed from the first column.
- The remaining first-column content should stay compact and readable at common desktop widths.
- Existing Session Detail behavior outside the first column should remain unchanged.

## Acceptance Criteria

- Desktop Session Detail shows the session name as the first-column H1.
- The prompt summary label reads `INITIAL PROMPT`.
- `LATEST MESSAGE` appears directly below `INITIAL PROMPT`.
- The standalone `STATUS` panel is no longer rendered in the first column.
- No unrelated Session Detail tabs or mobile layouts regress.

## References

- [client/src/components/SessionDetail/SessionDetail.tsx](../client/src/components/SessionDetail/SessionDetail.tsx)
- [client/src/components/SessionDetail/SessionMeta.tsx](../client/src/components/SessionDetail/SessionMeta.tsx)

## Related Issues

- [260323_session-detail-overview-column-redesign.md](260323_session-detail-overview-column-redesign.md)
- [260402_session-detail-column1-cap-500px-column2-fill-remaining-space.md](260402_session-detail-column1-cap-500px-column2-fill-remaining-space.md)
- [260406_desktop-session-detail-relative-timestamps-and-tab-order.md](260406_desktop-session-detail-relative-timestamps-and-tab-order.md)

## Notes

- This is a narrow desktop-first refinement of the overview column, not a broader session data model change.
- Preserve the rest of the desktop Session Detail layout and interactions.
