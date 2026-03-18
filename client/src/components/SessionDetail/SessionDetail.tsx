import { useParams } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { SessionMeta } from './SessionMeta.tsx';
import { MessageBubble } from './MessageBubble.tsx';

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, error } = useSession(id ?? '');

  if (loading && !session) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">
        {error}
      </div>
    );
  }

  if (!session) return null;

  return (
    <div>
      <SessionMeta session={session} />

      <div className="rounded-lg border border-gh-border overflow-hidden">
        {session.messages.length === 0 ? (
          <div className="p-8 text-center text-gh-muted text-sm">
            No messages in this session.
          </div>
        ) : (
          <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
            {session.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
