---
description: Learn how to show or hide sessions with Unknown context in the session list.
---

# How to Show or Hide Unknown Context Sessions

By default, the Copilot Sessions Dashboard hides sessions with an "Unknown" context to reduce clutter and help you focus on active working sessions. This guide explains how to toggle this filter.

## What are Unknown Context Sessions?

Sessions with "Unknown" context are typically:
- Sessions created before context detection was available
- Sessions started outside of a recognized project directory
- Legacy sessions without proper workspace association

## Show Unknown Sessions

### In the Main Session List

1. Navigate to the **Sessions** page (the dashboard home)
2. Locate the **Show Unknown** toggle in the filter bar
3. Click the toggle to enable it
4. The list will refresh to include all sessions, including those with Unknown context

### In the Session Detail Sidebar

1. Open any session to view its details
2. Look at the right sidebar labeled "Sessions"
3. Find the **Show Unknown** toggle below the sort controls
4. Click to enable and see Unknown sessions in that project context

## Hide Unknown Sessions

To hide Unknown sessions again:

1. Simply click the **Show Unknown** toggle again to turn it off
2. The list will refresh, filtering out sessions with Unknown context

## Default Behavior

- **Default state**: Unknown sessions are **hidden**
- The filter applies to:
  - Main session browse page
  - Session detail sidebar
  - All variants of the session list view
- The filter is a presentation-level change; no data is deleted or modified

## Related

- [Session Data Model Reference](../../reference/session-state/session-data-model.md)
- [Client Architecture Reference](../../reference/client/client-architecture.md)
