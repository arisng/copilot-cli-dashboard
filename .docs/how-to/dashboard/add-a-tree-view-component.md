# How to Add a Tree View Component

This guide walks you through adding a collapsible tree view to a new or existing dashboard component.

## Prerequisites

- Familiarity with React and TypeScript
- Understanding of the `SessionArtifactEntry` type from the API client
- Knowledge of Tailwind CSS utility classes

## Basic Implementation

### Step 1: Import the FileTree Component

```typescript
import { FileTree } from './FileTree.tsx';
```

### Step 2: Prepare Your Data

Ensure your data follows the `SessionArtifactEntry` interface:

```typescript
interface SessionArtifactEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  modifiedAt: string;
  content?: string;
  children?: SessionArtifactEntry[];
}
```

### Step 3: Use the Component

```tsx
function MyComponent({ entries }: { entries: SessionArtifactEntry[] }) {
  const [selectedPath, setSelectedPath] = useState('');

  return (
    <FileTree
      entries={entries}
      selectedPath={selectedPath}
      onSelectFile={setSelectedPath}
    />
  );
}
```

## Customization Options

### Handling File Selection

The `onSelectFile` callback receives the file path. Use this to:
- Display file content in a preview panel
- Navigate to a detail view
- Trigger a download

```typescript
const handleSelectFile = useCallback((path: string) => {
  setSelectedPath(path);
  // Fetch file content, update URL, etc.
}, []);
```

### Styling the Container

The FileTree fills its container. Control the layout using the parent:

```tsx
<div className="h-64 overflow-hidden rounded-lg border border-gh-border">
  <FileTree entries={entries} selectedPath={selectedPath} onSelectFile={setSelectedPath} />
</div>
```

## Common Patterns

### Two-Panel Layout

Display the tree on the left and file content on the right:

```tsx
<div className="grid grid-cols-[18rem_1fr] gap-3">
  <aside className="border-r border-gh-border">
    <FileTree entries={entries} selectedPath={selectedPath} onSelectFile={setSelectedPath} />
  </aside>
  <section>
    {selectedFile ? <FilePreview file={selectedFile} /> : <EmptyState />}
  </section>
</div>
```

### Loading States

Show a loading state while fetching file data:

```tsx
{loading ? (
  <div className="p-4 text-sm text-gh-muted">Loading files...</div>
) : (
  <FileTree entries={entries} selectedPath={selectedPath} onSelectFile={setSelectedPath} />
)}
```

### Empty States

The FileTree handles empty entries internally, but you can also check before rendering:

```tsx
{entries.length === 0 ? (
  <div className="p-4 text-sm text-gh-muted">No files available.</div>
) : (
  <FileTree entries={entries} selectedPath={selectedPath} onSelectFile={setSelectedPath} />
)}
```

## Testing Your Implementation

1. **Expand/Collapse**: Verify folders open and close correctly
2. **Global Controls**: Test expand/collapse all buttons
3. **File Selection**: Ensure clicking files triggers the callback
4. **Keyboard Navigation**: Test Enter, Space, and Arrow keys on folders
5. **Empty State**: Verify behavior with empty entries array
6. **Deep Nesting**: Test with deeply nested folder structures

## Troubleshooting

### Tree Doesn't Render

- Verify entries array is not empty
- Check that each entry has a unique `path` property
- Ensure `kind` is either `'file'` or `'directory'`

### Icons Not Showing

Icons use emoji characters. If they don't display:
- Check browser/console for font-related warnings
- Verify the device supports the emoji characters used
- Consider replacing with SVG icons if needed

### Performance Issues

For large file trees (1000+ items):
- Consider implementing virtualization
- Use React DevTools Profiler to identify bottlenecks
- Memoize the entries array if it doesn't change frequently

## See Also

- [File Tree Component Design](../../explanation/dashboard/file-tree-component-design.md) — Design decisions and architecture
- `client/src/components/SessionDetail/FileTree.tsx` — Source code
- `client/src/utils/fileUtils.ts` — File type detection utilities
