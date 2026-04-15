import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessions } from '../../hooks/useSessions.ts';
import {
  DEFAULT_SESSION_BROWSE_STATE,
  SESSION_BROWSE_SORT_FIELDS,
  SESSION_BROWSE_STATUS_OPTIONS,
  type SessionBrowseSortField,
  type SessionBrowseStatus,
  useSessionBrowse,
} from '../../hooks/useSessionBrowse.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import {
  BrowsePagination,
  BrowseSelect,
  BrowseSortOrderToggle,
  BrowseToggle,
  SESSION_BROWSE_SORT_FIELD_LABELS,
} from '../shared/SessionBrowseControls.tsx';
import { SessionRow } from './SessionRow.tsx';
import { SessionCard } from './SessionCard.tsx';

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className={active ? 'text-gh-text' : 'text-gh-muted'}>
      <path d="M2 4.75a.75.75 0 000 1.5h12a.75.75 0 000-1.5H2zm0 3.5a.75.75 0 000 1.5h12a.75.75 0 000-1.5H2zm0 3.5a.75.75 0 000 1.5h12a.75.75 0 000-1.5H2z" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className={active ? 'text-gh-text' : 'text-gh-muted'}>
      <path d="M1 2.75A1.75 1.75 0 012.75 1h3.5A1.75 1.75 0 018 2.75v3.5A1.75 1.75 0 016.25 8h-3.5A1.75 1.75 0 011 6.25v-3.5zm1.75-.25a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h3.5A.25.25 0 006.5 6.25v-3.5A.25.25 0 006.25 2.5h-3.5zM9 2.75A1.75 1.75 0 0110.75 1h3.5A1.75 1.75 0 0116 2.75v3.5A1.75 1.75 0 0114.25 8h-3.5A1.75 1.75 0 019 6.25v-3.5zm1.75-.25a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25h-3.5zM1 10.75A1.75 1.75 0 012.75 9h3.5A1.75 1.75 0 018 10.75v3.5A1.75 1.75 0 016.25 16h-3.5A1.75 1.75 0 011 14.25v-3.5zm1.75-.25a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25h-3.5zM9 10.75A1.75 1.75 0 0110.75 9h3.5A1.75 1.75 0 0116 10.75v3.5A1.75 1.75 0 0114.25 16h-3.5A1.75 1.75 0 019 14.25v-3.5zm1.75-.25a.25.25 0 00-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 00.25-.25v-3.5a.25.25 0 00-.25-.25h-3.5z" />
    </svg>
  );
}

const MAIN_LIST_PAGE_SIZE = 25;

export function SessionList() {
  const { sessions, loading, error } = useSessions();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('sessionViewMode') as 'list' | 'grid') ?? 'list',
  );
  const [browseState, setBrowseState] = useState(() => ({
    ...DEFAULT_SESSION_BROWSE_STATE,
    pageSize: MAIN_LIST_PAGE_SIZE,
  }));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionActive = selectedIds.size > 0;

  function toggleView(mode: 'list' | 'grid') {
    setViewMode(mode);
    localStorage.setItem('sessionViewMode', mode);
  }

  const activeSessions = sessions.filter((session) => session.isOpen);
  const browse = useSessionBrowse(activeSessions, browseState);
  const shownAttentionCount = browse.filteredSessions.filter((session) => session.needsAttention || session.lastError).length;
  const countLabel = browse.totalItems === activeSessions.length
    ? `${browse.totalItems} open session${browse.totalItems !== 1 ? 's' : ''}`
    : `${browse.totalItems} of ${activeSessions.length} open sessions`;

  function handleProjectChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      projectPath: value || null,
      branch: null,
      page: 1,
    }));
  }

  function handleBranchChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      branch: value || null,
      page: 1,
    }));
  }

  function handleStatusChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      status: value ? (value as SessionBrowseStatus) : null,
      page: 1,
    }));
  }

  function handleSortFieldChange(value: string) {
    setBrowseState((previous) => ({
      ...previous,
      sortField: value as SessionBrowseSortField,
      page: 1,
    }));
  }

  function handleSortOrderChange(value: 'asc' | 'desc') {
    setBrowseState((previous) => ({
      ...previous,
      sortOrder: value,
      page: 1,
    }));
  }

  function handlePageChange(page: number) {
    setBrowseState((previous) => ({
      ...previous,
      page,
    }));
  }

  function resetBrowse() {
    setBrowseState((previous) => ({
      ...previous,
      projectPath: null,
      branch: null,
      status: null,
      showUnknownContext: DEFAULT_SESSION_BROWSE_STATE.showUnknownContext,
      sortField: DEFAULT_SESSION_BROWSE_STATE.sortField,
      sortOrder: DEFAULT_SESSION_BROWSE_STATE.sortOrder,
      page: 1,
    }));
  }

  function toggleSelection(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function watchSelected() {
    const ids = Array.from(selectedIds).join(',');
    navigate(`/watch?ids=${ids}`);
  }

  const allPageSelected = browse.paginatedSessions.length > 0 && browse.paginatedSessions.every((session) => selectedIds.has(session.id));

  function toggleSelectAllPage() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allPageSelected) {
        for (const session of browse.paginatedSessions) {
          next.delete(session.id);
        }
      } else {
        for (const session of browse.paginatedSessions) {
          next.add(session.id);
        }
      }
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gh-text">Sessions</h1>
          <p className="text-gh-muted text-sm">
            {isSelectionActive
              ? `${selectedIds.size} selected`
              : countLabel}
            {!isSelectionActive && shownAttentionCount > 0 && (
              <span className="text-gh-attention ml-2">
                · {shownAttentionCount} need{shownAttentionCount !== 1 ? '' : 's'} attention
              </span>
            )}
          </p>
        </div>
        {isSelectionActive ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-xs font-medium text-gh-text transition-colors hover:bg-gh-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={watchSelected}
              className="rounded-md border border-gh-accent/30 bg-gh-accent/10 px-3 py-1.5 text-xs font-medium text-gh-accent transition-colors hover:bg-gh-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40"
            >
              Watch selected
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gh-border rounded overflow-hidden">
              <button
                type="button"
                onClick={() => toggleView('list')}
                title="List view"
                aria-pressed={viewMode === 'list'}
                className={`px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gh-accent/40 ${viewMode === 'list' ? 'bg-gh-surface text-gh-text' : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'}`}
              >
                <ListIcon active={viewMode === 'list'} />
              </button>
              <button
                type="button"
                onClick={() => toggleView('grid')}
                title="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`border-l border-gh-border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gh-accent/40 ${viewMode === 'grid' ? 'bg-gh-surface text-gh-text' : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'}`}
              >
                <GridIcon active={viewMode === 'grid'} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-gh-muted text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
              Auto-refresh 5s
            </div>
          </div>
        )}
      </div>

      {activeSessions.length > 0 && (
        <div className="mb-4 rounded-lg border border-gh-border bg-gh-surface/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <BrowseSelect
              label="Project"
              value={browse.projectPath ?? ''}
              onChange={handleProjectChange}
              options={[
                { value: '', label: 'All projects' },
                ...browse.projectOptions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
              className="min-w-[180px] flex-1 sm:flex-none"
            />
            <BrowseSelect
              label="Branch"
              value={browse.branch ?? ''}
              onChange={handleBranchChange}
              disabled={browse.projectPath === null}
              options={[
                { value: '', label: browse.projectPath ? 'All branches' : 'Select project first' },
                ...browse.branchOptions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
              className="min-w-[170px] flex-1 sm:flex-none"
            />
            <BrowseSelect
              label="Status"
              value={browse.status ?? ''}
              onChange={handleStatusChange}
              options={[
                { value: '', label: 'All statuses' },
                ...SESSION_BROWSE_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
              className="min-w-[150px] flex-1 sm:flex-none"
            />
            <BrowseSelect
              label="Sort"
              value={browseState.sortField}
              onChange={handleSortFieldChange}
              options={SESSION_BROWSE_SORT_FIELDS.map((field) => ({
                value: field,
                label: SESSION_BROWSE_SORT_FIELD_LABELS[field],
              }))}
              className="min-w-[180px] flex-1 sm:flex-none"
            />
            <BrowseSortOrderToggle value={browseState.sortOrder} onChange={handleSortOrderChange} />
            <BrowseToggle
              label="Show Unknown"
              checked={browseState.showUnknownContext}
              onChange={(checked) =>
                setBrowseState((previous) => ({
                  ...previous,
                  showUnknownContext: checked,
                  page: 1,
                }))
              }
            />
          </div>
        </div>
      )}

      {loading && activeSessions.length === 0 && <LoadingSpinner />}

      {error && (
        <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">
          {error}
        </div>
      )}

      {!loading && activeSessions.length === 0 && !error && (
        <div className="rounded-lg border border-gh-border bg-gh-surface p-8 text-center">
          <p className="text-gh-muted text-sm">
            {sessions.length === 0
              ? 'No sessions found in the detected Copilot session-state directories.'
              : 'No open sessions right now.'}
          </p>
          <p className="text-gh-muted text-xs mt-2">
            {sessions.length === 0
              ? 'Start a Copilot CLI session and it will appear here automatically.'
              : 'Start or resume a session and it will appear here automatically.'}
          </p>
        </div>
      )}

      {activeSessions.length > 0 && browse.totalItems === 0 && !error && (
        <div className="rounded-lg border border-gh-border bg-gh-surface p-8 text-center">
          <p className="text-gh-muted text-sm">No open sessions match the current filters.</p>
          <button
            type="button"
            onClick={resetBrowse}
            className="mt-3 rounded-md border border-gh-border bg-gh-bg px-3 py-1.5 text-xs text-gh-text transition-colors hover:bg-gh-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gh-bg"
          >
            Reset filters
          </button>
        </div>
      )}

      {browse.totalItems > 0 && (
        <>
          {viewMode === 'list' ? (
            <div className="max-w-full overflow-hidden rounded-lg border border-gh-border">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-gh-border bg-gh-surface">
                    <th className="w-10 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                        aria-label="Select all sessions on this page"
                        className="h-4 w-4 rounded border-gh-border bg-gh-bg text-gh-accent focus:ring-gh-accent/40"
                      />
                    </th>
                    <th className="w-[36%] px-4 py-2 text-left text-xs font-medium text-gh-muted">Session</th>
                    <th className="w-[36%] px-4 py-2 text-left text-xs font-medium text-gh-muted">Context</th>
                    <th className="w-[21%] px-4 py-2 text-right text-xs font-medium text-gh-muted">Activity</th>
                    <th className="py-2 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {browse.paginatedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      selected={selectedIds.has(session.id)}
                      onSelectToggle={() => toggleSelection(session.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {browse.paginatedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  selected={selectedIds.has(session.id)}
                  onSelectToggle={() => toggleSelection(session.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-3 rounded-lg border border-gh-border bg-gh-surface/20 px-4 py-3">
            <BrowsePagination
              page={browse.page}
              totalPages={browse.totalPages}
              totalItems={browse.totalItems}
              pageSize={browse.pageSize}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
