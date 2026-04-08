---
title: "Bug: CollapsibleMarkdown duplicates sub-section content when a heading is expanded"
type: "Bug"
status: "Closed"
author: "Copilot"
created: "2026-04-08"
severity: "High"
priority: "High"
---

## Summary

When a session artifact is rendered through `CollapsibleMarkdown`, clicking a collapsed heading to expand it
displays the section body — but that body already contains the raw markdown of nested sub-headings and their
content. Those same sub-headings are *also* rendered as their own independent collapsible sections in the
list below. The result is that every child heading and its content appears **twice** on screen simultaneously.

## Steps to Reproduce

1. Open the Session Detail view for any session whose plan / artifact has a multi-level heading structure, e.g.:

   ```md
   ## Section A
   Some intro text.
   ### Sub-section A1
   Detail content for A1.
   ### Sub-section A2
   Detail content for A2.
   ## Section B
   Another top-level section.
   ```

2. Collapse any top-level heading (H2) that has at least one nested sub-heading (H3 or deeper).
3. Click the collapsed heading title to expand it.

**Expected:** The section body reveals only the content directly under the heading, with nested headings shown
as their own subordinate collapsible rows.

**Actual:** The section body contains the full raw markdown of every child heading and its content (rendered
inline as plain headings). Those same child headings are **also** rendered as separate collapsible sections
below, producing visible duplicated blocks of text.

## Root Cause Analysis

### `parseMarkdownSections` — flat array with inclusive bodies

`CollapsibleMarkdown.tsx` calls `parseMarkdownSections(content)`, which flattens **every heading at every
level** (H1–H6) into a single, flat `sections[]` array. For each section the `body` is sliced from the line
after its own heading to the line before the *next heading of the same or higher level*:

```ts
// CollapsibleMarkdown.tsx – parseMarkdownSections
for (let j = i + 1; j < headings.length; j++) {
  if (headings[j].level <= h.level) {   // only stops at same-or-parent level
    endIndex = headings[j].index;
    break;
  }
}

sections.push({
  ...
  body: lines.slice(startIndex, endIndex).join('\n'),   // includes child headings!
});
```

Because the stop condition uses `<=`, a H2 section's `body` runs all the way through every H3, H4 … child
heading beneath it. Those child headings are literal markdown text inside `body`.

### Rendering — children appear twice

The `CollapsibleMarkdown` render loop then outputs every flat section (H2 **and** its H3 children) as
independent collapsible rows:

```tsx
{parsed.sections.map((section) => {
  const isExpanded = expandedIds.has(section.id);
  return (
    <section key={section.id} id={section.id}>
      <SectionHeading ... onToggle={() => toggleSection(section.id)}>
        {section.title}
      </SectionHeading>
      {isExpanded && (
        <div>
          {/* body contains child headings → renders them as plain headings */}
          <Markdown ...>{section.body}</Markdown>
        </div>
      )}
    </section>
  );
})}
```

When the H2 is expanded its `body`, rendered by `<Markdown>`, produces `<h3>Sub-section A1</h3>` (and so
on). Immediately below, the **same** H3 also appears as its own collapsible `<SectionHeading>` row —
duplication guaranteed.

## Affected Files

| File | Role |
|---|---|
| `client/src/components/shared/MarkdownRenderer/CollapsibleMarkdown.tsx` | Core logic: `parseMarkdownSections`, `CollapsibleMarkdown` render |
| `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx` | `collapsible` prop wires into `CollapsibleMarkdown` |
| `client/src/components/mobile/MobileSessionPane.tsx` | Uses `collapsible` prop — affected on mobile |

## Impact

- Every collapsible markdown view (desktop plan/checkpoint/research/files, mobile session pane) will show
  duplicate content for any document with more than one heading level.
- Content duplication makes artifact review unreliable; users cannot tell which instance is canonical.
- Severity is **High** because collapsible markdown is the primary rendering path for all session artifacts.

## Proposed Fix Directions

### Option 1 — Tree-aware section rendering (recommended)

Parse sections into a **tree** instead of a flat list. Children are nested inside their parent and only the
direct text content (before the first child heading) is used as a section's `body`. Children are rendered
recursively as indented collapsible sub-sections.

Key change in `parseMarkdownSections`: build a hierarchy where each section only owns the text lines
**up to** its first child heading; child headings become nested `MarkdownSection` nodes.

### Option 2 — Strip child headings from parent bodies

Keep the flat array but, when building `body`, set `endIndex` to stop at the **next heading of any level**
(not just same-or-higher). This removes child headings from the parent body entirely. The flat list already
renders them as their own rows, so no content is lost.

Change in `parseMarkdownSections`:

```ts
// Before
if (headings[j].level <= h.level) { ... }
// After — stop at ANY deeper heading too
if (headings[j].level <= h.level + 1) { ... }
// or unconditionally:
endIndex = headings[j + 1]?.index ?? lines.length;  // first next heading wins
```

### Option 3 — Render raw markdown; skip collapsible for mixed-depth content

Detect headings of mixed depth and fall back to non-collapsible `<Markdown>` rendering for documents that
would produce duplicates. Simplest guard, but loses the collapsible UX for complex documents.

## Acceptance Criteria

- [ ] Expanding any heading in a multi-level markdown document shows each piece of content exactly once.
- [ ] Child sections (H3, H4 …) are not rendered both inside a parent body AND as standalone rows.
- [ ] The outline / section navigation still lists all headings (H2 + H3 + …) for quick jumping.
- [ ] `Expand All` / `Collapse All` controls function correctly across all heading levels.
- [ ] Existing tests in `MarkdownRenderer.test.tsx` continue to pass; new regression tests cover
  multi-level heading documents.
- [ ] Desktop and mobile `collapsible` surfaces both behave correctly.

## References

- `client/src/components/shared/MarkdownRenderer/CollapsibleMarkdown.tsx` — `parseMarkdownSections`, `CollapsibleMarkdown`
- `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx` — `collapsible` prop / `CollapsibleMarkdown` integration
- `client/src/components/mobile/MobileSessionPane.tsx` lines 838, 1095 — mobile `collapsible` usage
- `.issues/260331_enhance-markdown-rendering-desktop-mobile-surfaces.md` — original markdown rendering enhancement issue
