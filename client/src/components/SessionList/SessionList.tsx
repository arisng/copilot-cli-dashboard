import { useSessions } from '../../hooks/useSessions.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { SessionRow } from './SessionRow.tsx';

export function SessionList() {
  const { sessions, loading, error } = useSessions();

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
        <div className="flex items-center gap-2 text-gh-muted text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-gh-active" />
          Auto-refresh 5s
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
      )}
    </div>
  );
}
