---
title: "Desktop Session Detail Sub-agent threads tab: single recency-sorted list with metadata"
type: "Feature"
status: "Completed"
author: "Copilot"
created: "2026-04-05"
priority: "Medium"
description: "Replace the current running/done grouping in the desktop Sub-agent threads tab with one list of all sub-agents sorted by last activity and showing agent_id, task description, and relative last activity time."
---

## Summary

The desktop Session Detail `Sub-agent threads` tab should stop splitting threads into `Running` and `Done` buckets and instead present one unified list of all sub-agents. Each row should surface the key details users need for quick scanning: `agent_id`, task description, and a human-readable last activity time such as `just now` or `8m ago`.

## Problem Statement

- We are still failing to detect sub-agent status reliably enough to trust running/done grouping.
- The current categorization creates false confidence and extra attempts while the UI tries to decide which bucket a thread belongs in.
- Users need a simple, scannable inventory of all sub-agent threads, ordered by recency, rather than a status split that may be wrong.
- The tab should prioritize lightweight metadata and recency until the status model is dependable again.

## Goals

1. Replace the desktop `Sub-agent threads` status buckets with a single list of all sub-agents.
2. Surface the most useful thread metadata directly in each row.
3. Sort the list by last activity time descending by default.
4. Render the last activity time in a relative format that is easy to scan.
5. Keep the change scoped to desktop Session Detail.

## Requirements

- The desktop `Sub-agent threads` tab must render one list, not separate `Running` and `Done` sections.
- Each list item should display:
  - `agent_id`
  - task description
  - last activity time
- Use the closest stable identifier available from the session model if the backing data does not expose a literal `agent_id` field, but label it as `agent_id` in the UI.
- Show last activity as a human-readable relative timestamp where possible, such as `just now`, `8m ago`, or `2h ago`.
- Default sorting must be descending by last activity time, with the most recently active thread first.
- Preserve a stable secondary sort for ties or missing timestamps so the list does not reshuffle unnecessarily.
- If a task description is missing or too long, provide a readable fallback that keeps the row usable.
- Keep any existing navigation or selection behavior for an individual thread if the current UI already supports it.
- Do not introduce new status-based grouping in this view.
- Mobile behavior and other Session Detail tabs should remain unchanged.

## Acceptance Criteria

- Desktop Session Detail shows a single `Sub-agent threads` list.
- No `Running` and `Done` section headings appear in that tab.
- Each row visibly includes `agent_id`, task description, and a relative last activity time.
- The default ordering is newest activity first.
- The list remains readable when some threads lack a task description or precise timestamp.
- The desktop-only change does not affect mobile layouts or unrelated tabs.

## Notes

- This is a temporary simplification until sub-agent status detection is trustworthy enough to support meaningful grouping again.
- The current sub-agent thread rendering in `client/src/components/SessionDetail/SessionDetail.tsx` is the most likely implementation anchor.
- If the UI already uses a relative-time helper elsewhere in Session Detail, reuse that pattern for consistency.

## References

- [client/src/components/SessionDetail/SessionDetail.tsx](../client/src/components/SessionDetail/SessionDetail.tsx)

## Related Issues

- [260325_session-detail-column2-vertical-tabs-filter.md](260325_session-detail-column2-vertical-tabs-filter.md)
- [260325_session-detail-column2-uxui-feedback.md](260325_session-detail-column2-uxui-feedback.md)