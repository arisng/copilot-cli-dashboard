---
title: "Normalize structural XML tags and nested list rendering in markdown viewer"
type: "Feature"
status: "Closed"
author: "Copilot"
created: "2026-04-07"
priority: "High"
description: "Teach the shared markdown viewer to normalize known XML-like section wrappers into markdown structure and to render nested ul/ol combinations as proper block-level nested lists with indentation."
---

# Normalize structural XML tags and nested list rendering in markdown viewer

## Summary

Enhance the shared markdown viewer so session artifacts that mix markdown with structural XML-like wrappers remain readable. The renderer should infer markdown-equivalent structure from known tag pairs that act as paragraph or section containers, and it should render nested unordered and ordered lists as separate block-level nested lists rather than inline text.

## Problem Statement

- Some session artifacts contain XML-like tag pairs that are used as structural wrappers around paragraphs or sections.
- Those tags currently appear literally or disrupt markdown structure, which makes mixed markdown/XML content harder to read.
- Nested `ul` inside `ol` and nested `ol` inside `ul` can render inline with the parent item instead of on their own line, flattening list hierarchy.
- The markdown viewer needs predictable behavior for these mixed-content documents so the rendered output matches the intended structure.

## Goals

1. Convert known structural XML-like tag pairs into equivalent markdown structure when rendering.
2. Preserve readability for markdown documents that mix markdown syntax with XML-like wrappers.
3. Render nested ordered/unordered lists as true nested blocks with indentation and line breaks.
4. Keep the behavior scoped to the shared markdown viewer so all consuming surfaces benefit consistently.

## Requirements

- Recognize known XML-like wrappers that are used as paragraph or section containers and normalize them into markdown-equivalent structure before render.
- When a tag pair semantically represents a heading or section title, render it as the appropriate markdown heading or section block instead of showing raw XML tags.
- Preserve unknown or unsupported tags safely rather than over-transforming arbitrary XML.
- Ensure nested `ul` inside `ol` and nested `ol` inside `ul` are emitted on separate lines with proper indentation and list semantics.
- Do not flatten nested list items into the same paragraph as the parent list item.
- Preserve existing support for standard markdown constructs, including headings, code blocks, tables, blockquotes, and task lists.
- Add regression coverage for mixed markdown/XML fixtures and for both nested list directions.
- Keep the implementation within the shared markdown rendering path used by desktop and mobile document views.

## Candidate Impacted Areas

- `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx`
- `client/src/components/shared/MarkdownRenderer/*`
- Shared markdown fixtures and tests under `client/src/components/shared/MarkdownRenderer/__fixtures__/`

## Acceptance Criteria

- Known structural XML-like wrappers are rendered as markdown-equivalent headings or section containers instead of raw tags.
- Mixed markdown/XML documents remain readable and preserve intended hierarchy.
- `ul` nested inside `ol` renders on its own line with correct indentation and bullets.
- `ol` nested inside `ul` renders on its own line with correct indentation and numbering.
- Nested lists are not merged into a single inline paragraph with the parent item.
- Existing markdown rendering behavior for other supported elements remains unchanged.
- Regression tests cover representative mixed-content and nested-list fixtures.

## Example Edge Case Fixture

```md
<history>
1. **Step one**
   - Nested bullet should be on a new line
   - Nested bullet should remain indented

2. **Step two**
   <section>
   This wrapper should render as structural markdown, not raw XML.
   </section>
</history>
```

Expected behavior: the structural wrapper tags should be normalized into readable markdown structure, and the nested list should preserve block-level hierarchy rather than appearing inline with the parent item.

## Risks

- Overly aggressive XML normalization could change content that was meant to remain literal.
- List rendering fixes can affect spacing in other markdown cases if the parser mapping is not precise.
- Mixed-content documents may need a clear allowlist of supported structural tags to avoid ambiguous transformations.

## Out of Scope

- General-purpose HTML sanitization work.
- Markdown authoring/editing features.
- Backend artifact generation changes.

## References

- Prior markdown rendering baseline: `.issues/260331_enhance-markdown-rendering-desktop-mobile-surfaces.md`
- Shared markdown viewer components in the client workspace
