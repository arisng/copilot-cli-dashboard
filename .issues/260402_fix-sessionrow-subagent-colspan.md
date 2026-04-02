---
title: "Fix SessionRow sub-agent row colspan mismatch"
type: "Bug"
status: "Ready"
author: "Copilot"
created: "2026-04-02"
priority: "Low"
---

## Summary

The `SubAgentRow` rendered inside `SessionRow.tsx` uses `colSpan={4}`, but the parent table now has 5 columns after the addition of the multi-select checkbox column. This causes the sub-agent row to not fill the full table width, leaving a layout gap.

## Affected File

- `client/src/components/SessionList/SessionRow.tsx`

## Root Cause

A checkbox column was added as the first `<th>` in the table header, increasing the column count from 4 to 5. The `SubAgentRow` component was not updated to reflect this change.

## Fix

Change `colSpan={4}` to `colSpan={5}` on the sub-agent row `<td>` element.

```tsx
<td className="py-2 px-4 pl-10" colSpan={5}>
```

## Acceptance Criteria

- [ ] `SubAgentRow` spans all 5 columns of the table.
- [ ] Sub-agent rows visually align with the right edge of the parent table when expanded.
- [ ] No layout regressions in list view.
