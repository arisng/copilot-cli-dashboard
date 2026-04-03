# Collapsible Markdown Implementation

## What we built

The dashboard now supports collapsible heading sections inside long markdown documents. Both the desktop and mobile plan viewers, as well as artifact file previews (checkpoints, research, files), can render heading-based sections that users can expand and collapse inline.

## How it works

### Parsing strategy

The implementation lives in `client/src/components/shared/MarkdownRenderer/CollapsibleMarkdown.tsx`. Instead of trying to hook into `react-markdown`'s AST traversal to wrap arbitrary elements, we pre-process the raw markdown string:

1. Split the content into lines.
2. Find ATX-style headings (`#` through `######`).
3. Group content into sections, where each section starts at a heading and continues until the next heading of the same or higher level.
4. Render each section with its own collapse state.

This approach keeps the logic simple and avoids fighting `react-markdown`'s component-level rendering model, which processes elements independently and has no native concept of "content between headings."

### Rendering pipeline

When `collapsible={true}` is passed to `MarkdownRenderer` (and the variant is `desktop` or `mobile`):

- If the document has fewer than 2 headings, we fall back to the normal `Markdown` renderer. This preserves the existing behavior for short documents, plain text files, and table-of-contents pages like `index.md`.
- If the document has 2+ headings, we render:
  - A **Sections** panel with expand-all / collapse-all controls.
  - An **outline** that lets users jump to any section. On desktop this is a nested vertical list; on mobile it is a horizontal scrollable chip list.
  - Each heading as a clickable row with a chevron toggle.
  - The section body rendered through the standard `react-markdown` pipeline so syntax highlighting, tables, task lists, and blockquotes keep working exactly as before.

### Line-ending gotcha

During development, the heading parser initially failed to match any headings in real plan files. The root cause was Windows-style `\r\n` line endings: splitting on `\n` left `\r` at the end of each line, and the regex `.+` does not match `\r`. The fix was to strip `\r` before splitting:

```ts
const lines = content.replace(/\r/g, '').split('\n');
```

## Lessons learned

### Vite Fast Refresh and non-component exports

`CollapsibleMarkdown.tsx` exports both the React component and a utility function (`parseMarkdownSections`). During HMR, Vite logs:

```
Could not Fast Refresh ("parseMarkdownSections" export is incompatible).
```

This is harmless at runtime and in production builds, but it means HMR full-page reloads may occur when editing that file. For a small shared component, the trade-off is acceptable. If the file grew larger, we would split the parser into a separate `.ts` file.

### Touch targets and nested interactions

On mobile, the plan content is already wrapped in a `<details>` card (the "Captured plan" expandable summary). Adding another layer of expand/collapse inside it could have created confusing nested interactions. In practice it works well because:

- The outer `<details>` controls the entire plan card.
- The inner collapsible sections control individual heading blocks within the plan.
- The outline chips are large enough to be tappable and scroll horizontally without competing with vertical swipe gestures.

### Scope of the change

We scoped the `collapsible` prop to document-style surfaces only (plan and artifact content). Message bubbles in the conversation thread do not use it, which avoids adding visual noise to short chat messages.

## Default state

Documents open with **all sections expanded**. This preserves the existing "read everything" experience and avoids surprising users who expect to see the full plan on first load. Users can then collapse sections as needed, or use "Collapse all" to get a high-level overview.
