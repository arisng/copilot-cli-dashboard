---
title: "Fix SessionRow checkbox keyboard conflict"
type: "Bug"
status: "Ready"
author: "Copilot"
created: "2026-04-02"
priority: "Low"
---

## Summary

In `SessionRow.tsx`, when the selection checkbox has focus and the user presses `Space`, two things happen simultaneously:
1. The checkbox toggles its checked state (expected).
2. The row's `handleRowKeyDown` handler fires, interpreting `Space` as a command to open the session detail page (unexpected).

This causes an abrupt navigation while the user is only trying to select/deselect the session via keyboard.

## Affected File

- `client/src/components/SessionList/SessionRow.tsx`

## Root Cause

The `handleRowKeyDown` function guards against `button` elements but does not guard against `input` elements:

```tsx
if (target.closest('button')) {
  return;
}
```

## Fix

Extend the guard to also bail out when the event target is inside an `input` (or specifically a checkbox):

```tsx
if (target.closest('button') || target.closest('input')) {
  return;
}
```

Alternatively, prevent default and stop propagation on the checkbox's `onKeyDown`.

## Acceptance Criteria

- [ ] Pressing `Space` while the checkbox is focused toggles selection without navigating to the session detail.
- [ ] Pressing `Enter` or `Space` on the row background (outside interactive controls) still opens the session detail.
- [ ] No keyboard navigation regressions for other interactive elements in the row.
