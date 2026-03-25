---
title: "Add Copilot CLI session artifact tabs in Session Detail column 2"
type: "Feature"
status: "Proposed"
author: "Copilot"
created: "2026-03-25"
priority: "Medium"
---

## Summary

Add explicit artifact tabs for Copilot CLI session state in desktop Session Detail column 2 of Desktop mode, with a new tab group that includes "Plan", "Checkpoints", and "Research".

The goal is to display the following folders for each active CLI session alongside existing session workflow tabs:
- `~\.copilot\session-state\<session-id>\checkpoints\`
- `~\.copilot\session-state\<session-id>\research\`

This enables developers to quickly inspect ongoing Copilot CLI progress artifacts without leaving the Session Detail context panel.

## Problem Statement

- Current desktop session detail UI does not show Copilot CLI session-state artifacts in column 2 tabs.
- Users must manually open filesystem paths, disrupting workflow.
- Existing tab set is limited and does not expose this valuable debug/recovery data.

## Goals

1. In Session Detail view, column 2 should include a tab bar with at least:
   - `Plan` (existing)
   - `Checkpoints` (new)
   - `Research` (new)
2. The new tabs should map to the corresponding file system directories under the current session ID.
3. Each tab panel should render a lightweight explorer/list for files in that folder (or a message if folder not found/empty).
4. Preserve current behavior for other tabs and avoid modal popups with heavyweight overhead.

## Requirements

- [ ] Update UI component: `client/src/components/SessionDetail/SessionTabNav.tsx` (or relevant tab nav) to include two new tabs.
- [ ] Add session overview binding to compute current session id and resolve path base `~/.copilot/session-state/<session-id>/...` (escape for Windows path format).
- [ ] Implement folder read path and fallback states in `client/src/components/SessionDetail/SessionDetail.tsx` or helper hook.
- [ ] Add new subcomponents for each panel (file list or placeholder text).
- [ ] Write tests for rendering new tabs and path resolution.
- [ ] Ensure this does not regress mobile layout (tab behavior should degrade gracefully).

## Acceptance Criteria

- [ ] Column 2 session detail tabs include `Plan`, `Checkpoints`, and `Research`.
- [ ] Switching tabs loads / displays the artifact folder contents or empty state message.
- [ ] Path is correctly derived from the session's `session-id` and is cross-platform safe.
- [ ] If artifact directories are missing, show a clear message with the expected location.
- [ ] Developer notes or links are added to session detail docs in `docs/client.md` or related docs.

## Notes

- This is a UX feature request, not a bug fix.
- Keep tab labels concise and consistent with existing UI language.
- If folder exploration is not supported yet, initial behavior can be a simple file names list with a future improvement ticket for full file preview.
