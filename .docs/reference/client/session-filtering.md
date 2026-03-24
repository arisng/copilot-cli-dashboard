---
description: Technical reference for the session filtering system, including the Unknown context filter implementation.
---

# Session Filtering Reference

This document describes the session filtering architecture and API for the Copilot Sessions Dashboard client.

## SessionBrowseState Interface

The central state interface for session list filtering:

```typescript
interface SessionBrowseState {
  projectPath: string | null;       // Filter by project path
  branch: string | null;            // Filter by git branch
  status: SessionBrowseStatus | null; // Filter by status
  showUnknownContext: boolean;      // Show/hide Unknown context sessions
  sortField: SessionBrowseSortField;
  sortOrder: SessionBrowseSortOrder;
  page: number;
  pageSize: number;
}
```

## Default State Values

```typescript
const DEFAULT_SESSION_BROWSE_STATE: SessionBrowseState = {
  projectPath: null,
  branch: null,
  status: null,
  showUnknownContext: false,  // Unknown sessions hidden by default
  sortField: 'last_activity',
  sortOrder: 'desc',
  page: 1,
  pageSize: 25,
};
```

## Unknown Context Detection

### isUnknownContext Function

Determines if a session has an Unknown context:

```typescript
function isUnknownContext(session: SessionSummary): boolean {
  const projectLabel = getProjectLabel(session.projectPath);
  return projectLabel === 'Unknown' || projectLabel === '';
}
```

A session is considered "Unknown" when:
- The project path label equals "Unknown"
- The project path label is empty (empty string)

## Filter Logic

### filterSessionsForBrowse

The main filtering function applies all active filters in sequence:

1. **Project filter**: Matches `session.projectPath` against selected project
2. **Branch filter**: Matches `session.gitBranch` against selected branch
3. **Status filter**: Matches session status (Needs attention, Working, etc.)
4. **Unknown context filter**: Excludes sessions where `isUnknownContext()` returns true, unless `showUnknownContext` is enabled

### Filter Application Order

Filters are applied as a chain of boolean checks. A session must pass ALL filters to be included in results.

## BrowseResult Output

The `useSessionBrowse` hook returns a `SessionBrowseResult`:

```typescript
interface SessionBrowseResult {
  projectOptions: SessionBrowseOption[];
  branchOptions: SessionBrowseOption[];
  filteredSessions: SessionSummary[];
  paginatedSessions: SessionSummary[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  projectPath: string | null;
  branch: string | null;
  status: SessionBrowseStatus | null;
}
```

## UI Components

### BrowseToggle

Toggle component for boolean filters like "Show Unknown":

```typescript
interface BrowseToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
  size?: 'default' | 'mobile';
}
```

Used in:
- `SessionList.tsx` - Main session list filter bar
- `SessionDetail.tsx` - Session sidebar filter controls

## Usage Example

```typescript
const [browseState, setBrowseState] = useState(() => ({
  ...DEFAULT_SESSION_BROWSE_STATE,
  pageSize: 25,
}));

const browse = useSessionBrowse(sessions, browseState);

// Toggle unknown context visibility
function handleShowUnknownChange(checked: boolean) {
  setBrowseState((prev) => ({
    ...prev,
    showUnknownContext: checked,
    page: 1, // Reset to first page when filter changes
  }));
}
```

## Related

- [Client Architecture](client-architecture.md)
- [Session Data Model](../session-state/session-data-model.md)
