---
title: "Add collapsible headings and quick section navigation to markdown viewer"
type: "Feature"
status: "Closed"
author: "Copilot"
created: "2026-04-03"
priority: "Medium"
---

## Summary

Enhance the shared markdown viewer used by desktop and mobile document surfaces so heading-based sections can be collapsed and expanded inline. The experience should make long markdown documents easier to scan, provide a clearer high-level overview, and support quick navigation to a specific section without manually scrolling through the full document body.

## Problem Statement

- Long plan, research, and file artifacts are currently rendered as fully expanded documents, which makes it harder to get a quick structural overview.
- The shared renderer already styles headings for desktop and mobile, but headings are passive text only and do not provide section-level interaction.
- Mobile is especially affected because long markdown documents consume vertical space quickly, making section discovery slower.
- Users who want to jump to a specific heading do not currently have a heading-derived navigation affordance in the markdown viewer.

## Goals

1. Make large markdown documents easier to scan on both desktop and mobile.
2. Let users collapse and expand heading sections without losing document structure.
3. Provide a quick way to navigate to a specific heading in long documents.
4. Keep behavior consistent across shared markdown surfaces that already rely on the common renderer.

## Requirements

- Implement collapsible heading behavior in the shared markdown rendering pathway rather than as separate one-off logic for desktop and mobile views.
- Support heading-driven section grouping for standard markdown headings (`h1` through `h6`).
- Treat a heading as the start of a collapsible section whose content continues until the next heading of the same or higher level.
- Show a clear expand/collapse affordance on each collapsible heading row in both desktop and mobile layouts.
- Provide a document-level control to expand all or collapse all when a markdown document contains multiple collapsible sections.
- Add a quick-navigation affordance derived from the parsed heading structure, such as an outline, jump list, or equivalent compact section navigator.
- Preserve readable rendering for documents that do not contain headings or that contain only a single heading.
- Preserve markdown content fidelity for existing supported elements inside collapsed sections, including tables, task lists, blockquotes, and fenced code blocks.
- Ensure the interaction is keyboard-accessible on desktop and uses touch-friendly targets on mobile.
- Keep the default initial state explicit and documented. If product direction is undecided, define whether documents open fully expanded, mostly collapsed, or remember the last user preference.

## Candidate Impacted Areas

- `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx`
- `client/src/components/SessionDetail/SessionDetail.tsx`
- `client/src/components/mobile/MobileSessionPane.tsx`
- Shared markdown styling and any helper used to parse or normalize heading structure

## Acceptance Criteria

- [x] In desktop markdown document views, users can collapse and expand individual heading sections.
- [x] In mobile markdown document views, users can collapse and expand individual heading sections with touch-friendly controls.
- [x] Long markdown documents expose a quick heading navigation affordance that lets the user jump to a chosen section.
- [x] A user can switch the document between expanded and collapsed overview states with a document-level control when multiple sections exist.
- [x] Collapsing a section hides only that section's body and preserves the heading row and section order.
- [x] Existing supported markdown constructs continue to render correctly after sections are expanded again.
- [x] Documents without meaningful heading structure continue to render without degraded layout or unnecessary controls.
- [x] The behavior is consistent across the shared desktop and mobile markdown viewing surfaces that render plan and artifact content.

## Design Notes

- The current shared renderer is the natural ownership point because both desktop and mobile document-style views already delegate heading rendering there.
- Scope this first to document-style markdown surfaces, such as plan and artifact content, before extending the same interaction to message bubbles where added controls may create visual noise.
- Prefer a heading-tree approach over ad hoc DOM inspection so collapse state, outline generation, and section navigation are driven from the same parsed structure.
- Decide whether collapsed state is local to the current render, persisted per session/document, or tied to a global user preference.

## Risks

- Sectionization based on heading levels can produce surprising behavior for malformed markdown documents.
- Adding section state and a heading outline can increase renderer complexity and introduce performance regressions for large artifacts.
- Mobile affordances can become visually crowded if heading toggles and jump navigation are not carefully condensed.

## Out of Scope

- Markdown authoring or editing workflows.
- Changes to backend artifact generation.
- General-purpose collapse behavior for non-document UI panels that are unrelated to markdown rendering.

## References

- Existing shared renderer already used by desktop and mobile markdown surfaces.
- Prior completed baseline rendering work: `.issues/260331_enhance-markdown-rendering-desktop-mobile-surfaces.md`