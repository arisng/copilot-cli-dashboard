# File Tree Component Design

## Overview

The Files tab in the session detail view uses a tree component to display hierarchical file structures. This document explains the design decisions and patterns used.

## Why a Tree View?

Previously, the Files tab displayed files in a flat list with nested children. This approach had several limitations:

- **Visual overload**: All items rendered at once, regardless of nesting depth
- **Poor scannability**: Users couldn't collapse folders to focus on specific areas
- **No bulk controls**: No way to expand/collapse all folders at once

The tree view addresses these issues by:
- Providing progressive disclosure through collapsible folders
- Supporting global expand/collapse controls
- Using visual hierarchy (indentation, icons) to indicate structure

## Component Architecture

### FileTree

The main component manages:
- **State**: Tracks which folders are expanded via `Set<string>` of paths
- **Controls**: Toolbar with expand/collapse all buttons
- **Rendering**: Maps entries to `FileTreeItem` components

### FileTreeItem

Each item handles:
- **Interaction**: Click to toggle folders, select files
- **Visual states**: Selected, expanded, hover states
- **Icons**: Different icons for file types (images, code, docs, archives)
- **Depth-based indentation**: 12px per nesting level

## State Management

### Initial State

All folders start expanded to give users a complete view of the structure:

```typescript
const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
  const allFolders = collectFolderPaths(entries);
  return new Set(allFolders);
});
```

### Toggle Behavior

Individual folders toggle independently. The global controls operate on all folders:

```typescript
const handleExpandAll = useCallback(() => {
  const allFolders = collectFolderPaths(entries);
  setExpandedPaths(new Set(allFolders));
}, [entries]);

const handleCollapseAll = useCallback(() => {
  setExpandedPaths(new Set());
}, []);
```

## File Type Detection

File types are detected by extension to show appropriate icons:

| Category | Extensions | Icon |
|----------|-----------|------|
| Images | `.png`, `.jpg`, `.svg`, etc. | 🖼 |
| Code | `.ts`, `.tsx`, `.js`, `.json`, etc. | 📄 |
| Documents | `.md`, `.txt`, `.rst` | 📝 |
| Archives | `.zip`, `.tar`, `.gz` | 📦 |
| Default | All others | 📄 |

This classification is handled by utility functions in `client/src/utils/fileUtils.ts`.

## Keyboard Accessibility

Folders support keyboard navigation:
- **Enter/Space**: Toggle expand/collapse
- **Arrow Right**: Expand folder
- **Arrow Left**: Collapse folder

Files are clickable but not focusable (they trigger file selection in the parent component).

## Lessons Learned

### Recursive Rendering Performance

The component uses recursive rendering for nested structures. For very large file trees, consider:
- Virtualization (render only visible items)
- Lazy loading of folder contents
- Pagination for flat file lists

### State Persistence

Currently, expanded state resets when navigating away. Future enhancements could:
- Persist state in session storage
- Remember user preferences per session
- Restore previous state on return

### Icon Strategy

Using emoji icons keeps the bundle size small. For a production app, consider:
- SVG icons for consistency across platforms
- Theming support (light/dark mode icons)
- Custom icon sets for brand alignment

## Related Components

- `ArtifactGroupPanel`: Container that uses FileTree for checkpoints, research, and files
- `SessionDetail`: Main view that coordinates tab navigation
- `fileUtils.ts`: Helper functions for file type detection
