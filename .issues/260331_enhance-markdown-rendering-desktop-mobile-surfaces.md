---
title: "Enhance markdown rendering across desktop and mobile session artifact surfaces"
type: "Feature"
status: "Proposed"
author: "Copilot"
created: "2026-03-31"
priority: "High"
---

## Summary

Improve markdown rendering quality and consistency for all UI surfaces that display markdown content in both desktop and mobile modes.

Primary target content includes session artifacts under Copilot CLI session state, such as:
- `~/.copilot/session-state/<session-id>/plan.md`
- `~/.copilot/session-state/<session-id>/checkpoints/*`
- `~/.copilot/session-state/<session-id>/research/*`
- `~/.copilot/session-state/<session-id>/files/*`

## Problem Statement

- Markdown presentation is inconsistent across different views and breakpoints.
- Complex markdown structures (tables, task lists, fenced code blocks, nested lists, blockquotes) can degrade readability or layout.
- Session artifact content frequently mixes markdown syntax with XML-like wrappers/tags (for example `<history>...</history>`), and current rendering can mangle structure.
- Nested unordered lists inside ordered lists are not reliably rendered, causing incorrect visual hierarchy and loss of context.
- Desktop and mobile may use different rendering paths, creating behavior mismatches and user confusion.
- Artifact-heavy workflows rely on markdown as a primary medium, so rendering defects reduce debugging and review effectiveness.

## Goals

1. Standardize markdown rendering behavior across all desktop and mobile UI locations.
2. Ensure artifact documents remain readable and structurally correct for common markdown constructs.
3. Provide predictable fallback behavior when content is malformed or partially supported.
4. Preserve responsive layout and performance when rendering large markdown files.

## Requirements

- [ ] Inventory every markdown display surface in the client (desktop and mobile) and document the coverage list.
- [ ] Introduce or consolidate a shared markdown renderer abstraction/component used by all surfaces.
- [ ] Support at minimum: headings, links, inline code, fenced code blocks, blockquotes, ordered/unordered lists, task lists, tables, horizontal rules, and images.
- [ ] Define and implement handling for mixed markdown + XML-like content blocks in artifacts (preserve readable output, avoid flattening structure).
- [ ] Preserve list hierarchy for ordered lists containing nested unordered lists (including multi-level nesting with code spans and bold text).
- [ ] Ensure long lines and large code blocks are handled with horizontal scroll or wrap rules that do not break layout.
- [ ] Apply safe rendering defaults (sanitization/allowlist policy) to avoid unsafe HTML/script injection.
- [ ] Ensure internal navigation links and external links behave consistently across desktop and mobile.
- [ ] Extend artifact handling to include `files` folder markdown/text documents in addition to `plan.md`, `checkpoints`, and `research`.
- [ ] Add loading, empty, and parse-error states where artifact markdown cannot be rendered.
- [ ] Add or update tests for renderer parity between desktop and mobile.
- [ ] Add regression fixtures that include mixed markdown + XML-like wrappers and nested list combinations similar to Copilot session artifact history logs.
- [ ] Update client documentation with supported markdown features and known limitations.

## Candidate Impacted Areas

- `client/src/components/SessionDetail/SessionDetail.tsx`
- `client/src/components/mobile/MobileSessionDetail.tsx`
- `client/src/components/SessionDetail/MessageBubble.tsx`
- `client/src/api/client.ts` (artifact model/path support)
- Shared styling hooks or markdown component mappings used by desktop/mobile views

## Acceptance Criteria

- [ ] The same markdown artifact renders with consistent structure and styling on desktop and mobile views.
- [ ] `plan.md`, `checkpoints`, `research`, and `files` artifacts are all rendered through the shared markdown pathway.
- [ ] Tables and fenced code blocks are readable on narrow mobile widths without content clipping.
- [ ] A mixed markdown/XML artifact example (for example a `<history>` wrapper containing ordered items and nested bullets) renders without collapsing list hierarchy.
- [ ] Ordered list items with nested unordered sub-items display with correct indentation, numbering, and bullet nesting on both desktop and mobile.
- [ ] Unsafe markdown/HTML content is blocked or sanitized according to policy.
- [ ] Regression tests pass for representative markdown fixtures (simple, complex, malformed).

## Example Edge Case Fixture

Use a fixture patterned after real session artifacts, where xml-like wrappers surround markdown content:

```md
<history>

1. **User invoked `skill-creator` skill**
	- Read existing files and references
	- Identified issues and applied edits

2. **User requested fleet-mode batch work**
	- Dispatched parallel subagents
	- Collected status updates

</history>
```

Expected behavior: preserve readable structure, keep ordered and nested unordered hierarchy intact, and avoid flattening sub-items into plain paragraphs.

## Risks

- Rendering library or plugin selection may increase bundle size.
- Strict sanitization may remove formatting that users expect from permissive markdown renderers.
- Mobile performance may regress for very large documents if virtualization or chunked rendering is not considered.

## Out of Scope

- WYSIWYG markdown editing.
- Real-time collaborative markdown editing.
- Changes to backend session artifact generation format.

## Notes

- This issue is focused on rendering parity and reliability, not content authoring workflows.
- If feature support must be phased, prioritize readability-critical artifacts and document staged rollout.