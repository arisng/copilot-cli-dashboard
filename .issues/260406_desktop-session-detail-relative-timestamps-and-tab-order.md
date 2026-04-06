---
title: "Desktop Session Detail feedback: relative timestamps and tab order"
type: "Feature"
status: "Done"
author: "Copilot"
created: "2026-04-06"
priority: "Medium"
description: "Capture desktop Session Detail feedback for relative timestamps in key tabs and moving Sub-agent threads directly below Main session."
---

# Desktop Session Detail feedback: relative timestamps and tab order

## Summary

Recent feedback on the desktop Session Detail page calls for two related improvements:
- make time metadata easier to scan across the main content tabs
- move `Sub-agent threads` closer to `Main session` in the desktop tab order

The goal is to make recency and thread grouping more visible without changing the underlying session model.

## Problem Statement

- `Main session` does not currently emphasize the recency of the latest user/assistant activity.
- `Plan` needs a clearer indicator of when it was last updated.
- `Todos` are easier to scan when each item shows both creation and last-update recency.
- `Checkpoints` and `Research` file lists should show when each file was created so the newest artifacts are obvious.
- `Sub-agent threads` is useful enough to sit immediately below `Main session`, rather than later in the tab rail.

## Goals

1. Surface compact relative timestamps in the desktop Session Detail views that benefit from recency scanning.
2. Keep the timestamp treatment consistent across `Main session`, `Plan`, `Todos`, `Checkpoints`, and `Research`.
3. Reorder the desktop tab rail so `Sub-agent threads` is adjacent to `Main session`.
4. Keep the change scoped to desktop Session Detail unless a later follow-up intentionally shares the behavior with mobile.

## Requirements

- The `Main session` tab should show a relative `last message on` timestamp.
- The `Plan` tab should show a relative `last updated` timestamp.
- The `Todos` tab should show relative `created on` and `last updated on` timestamps for each todo item.
- The `Checkpoints` tab should show a relative `created on` timestamp for each checkpoint markdown file in the files list view.
- The `Research` tab should use the same relative `created on` treatment for each file in its list view.
- In the desktop tab rail, `Sub-agent threads` should move directly below `Main session`. And for each sub-agent list item, should show the exact LLM used by the sub-agent thread (e.g. `gpt-4o`) and the agent type (e.g. Generic-Research-Agent, Explore Agent, code-reviewer, Task Agent, etc). Agent type is not same as agent_id (agent_id is a unique identifier for each agent thread, while agent type is the custom agent's name or Copilot CLI built-in agent's name).
- The timestamp presentation should stay compact and legible enough to scan quickly in the existing desktop layout.
- If there is already a shared relative-time pattern elsewhere in Session Detail, this work should reuse it for consistency.

## Acceptance Criteria

- The `Main session` tab exposes a relative `last message on` value.
- The `Plan` tab exposes a relative `last updated` value.
- Each todo item shows relative `created on` and `last updated on` metadata.
- Each checkpoint and research file row shows a relative `created on` value.
- `Sub-agent threads` appears immediately below `Main session` in the desktop tab order.
- The desktop Session Detail layout remains readable and no unrelated tabs change behavior.

## References

- [client/src/components/SessionDetail/SessionDetail.tsx](../client/src/components/SessionDetail/SessionDetail.tsx)
- [client/src/components/SessionDetail/SessionTabNav.tsx](../client/src/components/SessionDetail/SessionTabNav.tsx)
- [client/src/components/SessionDetail/SessionMeta.tsx](../client/src/components/SessionDetail/SessionMeta.tsx)

## Related Issues

- [260405_desktop-session-detail-subagent-threads-recency-sorted-list.md](260405_desktop-session-detail-subagent-threads-recency-sorted-list.md)
- [260325_session-detail-column2-uxui-feedback.md](260325_session-detail-column2-uxui-feedback.md)
- [260405_enhance-files-tab.md](260405_enhance-files-tab.md)