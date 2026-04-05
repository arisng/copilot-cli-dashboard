---
description: Understanding the design decisions behind the Session Detail view's third column (Session Sidebar).
---

# Session Sidebar Column Design

This document explains the design rationale and implementation approach for the Session Detail view's third column (Session Sidebar), which displays other sessions in the same workspace.

## Problem Statement

The original workspace session list in column 3 had several UX issues:
- Column width could grow unbounded, stealing space from the main content
- Long session titles were truncated with no way to see the full text
- No quick way to open a peer session without losing current context
- Single-line truncation made comparing similar session names difficult

## Design Principles

### Constrained Sidebar

The column is now capped at **450px maximum width**:

- **Predictable layout**: Content area always has sufficient space
- **Sidebar metaphor**: Treats column 3 as auxiliary navigation, not primary content
- **Visual balance**: Prevents the three-column layout from feeling lopsided

### Readable Session Names

Session titles use `line-clamp-2` instead of `truncate`:

- **Two-line wrapping**: Long titles can occupy up to two lines before truncating
- **Better scanning**: Users can distinguish between similar session names more easily
- **Hover tooltip**: Full session name available on hover via `title` attribute

### Contextual Actions

Right-clicking a session item reveals a context menu:

- **Non-disruptive**: Current session remains active and visible
- **Familiar pattern**: Matches browser and OS context menu conventions
- **"Open in new tab"**: Allows comparing multiple sessions side-by-side

## Implementation Details

### Grid Layout

```typescript
// Third column capped at 450px
xl:grid-cols-[minmax(16rem,450px)_minmax(0,1fr)_minmax(18rem,450px)]
2xl:grid-cols-[minmax(16rem,450px)_minmax(0,1fr)_minmax(20rem,450px)]
```

### Session Item Component

```typescript
// Text wrapping with line-clamp-2
<p className="line-clamp-2" title={s.title}>
  {s.title}
</p>
```

### Context Menu

- Positioned absolutely at click coordinates
- Backdrop overlay for dismissal (click or right-click)
- Uses GitHub-inspired styling (`gh-surface`, `gh-accent`)
- Opens session in new browser tab via `window.open()`

## Accessibility Considerations

- **Keyboard users**: Left-click navigation remains unchanged
- **Screen readers**: Title attribute provides full session name
- **Focus management**: Context menu can be dismissed via Escape (clicking backdrop)
- **Color contrast**: Follows dashboard's `gh-*` token system

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| < 1280px | Column 3 hidden (toggleable via button) |
| 1280px+ | Column 3 visible, capped at 450px |
| 1440px+ | Optimal three-column layout |

## Future Considerations

Potential enhancements for the Session Sidebar:
- Middle-click to open in new tab (standard browser behavior)
- Drag-and-drop session reordering
- Pin/favorite sessions within the list
- Session grouping by date or status
