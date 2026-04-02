---
title: "Desktop Session Detail: cap column 1 at 500px and let column 2 fill remaining width"
type: "Task"
status: "Closed"
author: "Copilot"
created: "2026-04-02"
resolved: "2026-04-02"
priority: "Medium"
---

## Summary

In desktop Session Detail view, the first column should stop growing once it reaches 500px. The second column should then absorb the remaining horizontal space so the primary session content has a wider, more readable layout.

## Problem Statement

- The leftmost column can claim too much horizontal space on wide desktop viewports.
- Column 2 is the primary reading and interaction surface, but it does not consistently receive the leftover width.
- The layout needs a clear width rule so the desktop experience scales predictably.

## Goals

1. Constrain desktop Session Detail column 1 to a maximum width of 500px.
2. Make column 2 flex to fill the remaining gap.
3. Keep the change limited to desktop mode and preserve mobile behavior.
4. Avoid introducing horizontal overflow or layout collapse at common desktop widths.

## Requirements

- [ ] Update the desktop Session Detail layout container so column 1 uses a max width of 500px.
- [ ] Ensure column 2 is set to grow and consume the remaining available space.
- [ ] Verify the layout remains stable at 1280px, 1440px, and 1920px wide screens.
- [ ] Preserve the existing mobile layout and any non-desktop responsive rules.
- [ ] Keep the change aligned with the current Session Detail component structure rather than introducing a separate layout system.

## Acceptance Criteria

- [ ] On desktop, column 1 never exceeds 500px.
- [ ] Column 2 expands to use leftover width without leaving an awkward gap.
- [ ] Session content remains readable and no new overflow appears.
- [ ] Mobile Session Detail behavior is unchanged.
- [ ] The layout still works with existing tabs, message content, and side panels.

## Notes

- This is a narrow follow-up to the broader desktop Session Detail layout work.
- If the layout is controlled by a shared grid or flex wrapper, apply the width rule there rather than inside a deeply nested child.
