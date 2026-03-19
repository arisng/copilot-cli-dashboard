import { useState } from 'react';
import { useSessions } from '../../hooks/useSessions.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
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

export function SessionList() {
  const { sessions, loading, error } = useSessions();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('sessionViewMode') as 'list' | 'grid') ?? 'list'
  );

  function toggleView(mode: 'list' | 'grid') {
    setViewMode(mode);
    localStorage.setItem('sessionViewMode', mode);
  }

  const activeSessions = sessions.filter((s) => s.isOpen);
  const attentionCount = activeSessions.filter((s) => s.needsAttention).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gh-text">Sessions</h1>
          <p className="text-gh-muted text-sm">
            {activeSessions.length} session{activeSessions.length !== 1 ? 's' : ''}
            {attentionCount > 0 && (
              <span className="text-gh-attention ml-2">
                · {attentionCount} need{attentionCount !== 1 ? '' : 's'} attention
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center border border-gh-border rounded overflow-hidden">
            <button
              onClick={() => toggleView('list')}
              title="List view"
              className={`px-2 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-gh-surface text-gh-text' : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'}`}
            >
              <ListIcon active={viewMode === 'list'} />
            </button>
            <button
              onClick={() => toggleView('grid')}
              title="Grid view"
              className={`px-2 py-1.5 border-l border-gh-border transition-colors ${viewMode === 'grid' ? 'bg-gh-surface text-gh-text' : 'text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'}`}
            >
              <GridIcon active={viewMode === 'grid'} />
            </button>
          </div>
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 text-gh-muted text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
            Auto-refresh 5s
          </div>
        </div>
      </div>

      {/* States */}
      {loading && activeSessions.length === 0 && <LoadingSpinner />}

      {error && (
        <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">
          {error}
        </div>
      )}

      {!loading && activeSessions.length === 0 && !error && (
        <div className="rounded-lg border border-gh-border bg-gh-surface p-8 text-center">
          <p className="text-gh-muted text-sm">
            No sessions found in <code className="font-mono text-xs bg-gh-bg px-1 rounded">~/.copilot/session-state/</code>
          </p>
          <p className="text-gh-muted text-xs mt-2">
            Start a Copilot CLI session and it will appear here automatically.
          </p>
        </div>
      )}

      {activeSessions.length > 0 && (
        viewMode === 'list' ? (
          <div className="rounded-lg border border-gh-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gh-border bg-gh-surface">
                  <th className="py-2 px-4 text-left text-gh-muted text-xs font-medium">Session</th>
                  <th className="py-2 px-4 text-left text-gh-muted text-xs font-medium hidden sm:table-cell">Project</th>
                  <th className="py-2 px-4 text-right text-gh-muted text-xs font-medium hidden md:table-cell">Duration</th>
                  <th className="py-2 px-4 text-right text-gh-muted text-xs font-medium">Last activity</th>
                  <th className="py-2 px-4" />
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
