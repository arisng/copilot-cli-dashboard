---
title: "Session list default filter: hide Unknown context items"
type: "Feature"
status: "Resolved"
author: "Copilot"
created: "2026-03-23"
resolved: "2026-03-24"
priority: "Medium"
---

## Summary

In session listing UI, apply a default filter that excludes sessions whose `context` is `Unknown`. This ensures working sessions are prioritized and reduces noise from incomplete session records.

## Background

Current session view includes sessions with context `Unknown`, which can clutter the list and make it harder for users to quickly find active sessions. For projects where context inference is available, the default list should focus on meaningful sessions.

## Requirements

1. List query defaults
   - Update session list data provider (server query + client filtering) to omit `context === "Unknown"` or `project === "Unknown"` by default.
   - Applies to: main session browse page, desktop session detail sidebar session list, and any variant of the session list view.

2. UI filter controls
   - Keep existing context filter options available in the controls.
   - Add explicit UI item: "Show Unknown" or similar toggle if users want to include these sessions.
   - When "Show Unknown" is not enabled, sessions with `context === "Unknown"` or `project === "Unknown"` should be hidden.

3. State persistence
   - If user uses explicit context filter that includes `Unknown`, persist that choice in session state (URL query, local state, or Redux-like store depending on architecture).
   - Defaults to hide Unknown on initial render only.

4. Performance and correctness
   - Ensure there is no performance regression in server-side query execution.
   - Keep the fault tolerance path: if context is missing (undefined/null), treat same as Unknown for filtering and allow explicit inclusion.

## Acceptance criteria

- [ ] Default session list excludes any session where `context === "Unknown"` or `project === "Unknown"`.
- [ ] Existing context filter dropdown still includes `Unknown` and/or show-filter toggle.
- [ ] User can actively include Unknown in list via an explicit filter action.
- [ ] Desktop and mobile list views behave consistently for this default filter.
- [ ] Tests added/updated for default skip behavior and optional include behavior.

## Notes

- Do not mask or remove records from storage; this is a presentation-level default filter.
- Verify for both server `GET /sessions` search and client-side `useSessions` hook or equivalent list composition layer.
- If necessary, extend `sessionTypes` or search model with a utility helper like `isUnknownContext(session)`.

## QA Suggestions

- Manual: load fresh session list, confirm no Unknown-context sessions in results prior to toggling filter.
- Manual: enable explicit "show unknown" and confirm Unknown sessions appear.
- Automated: add unit tests for list generator in `server/utils/needsAttention.ts` or session filtering utilities, and a UI test in `client` to confirm default behavior.

## Related issues

- .issues/260323_enhance-desktop-session-uxui.md (session list behavior and filtering improvements).