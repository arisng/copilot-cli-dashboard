import Markdown from 'react-markdown';
import type { ParsedMessage, ToolRequest } from '../../api/client.ts';
import { RelativeTime } from '../shared/RelativeTime.tsx';

interface Props {
  message: ParsedMessage;
}

function ToolCallBlock({ tool }: { tool: ToolRequest }) {
  const argsStr = JSON.stringify(tool.arguments, null, 2);
  const preview = argsStr.length > 300 ? argsStr.slice(0, 300) + '\n  …' : argsStr;

  return (
    <details className="mt-1.5 rounded border border-gh-border bg-gh-bg text-xs group">
      <summary className="px-3 py-1.5 cursor-pointer list-none flex items-center gap-2 text-gh-muted hover:text-gh-text">
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
        <span className="font-mono text-gh-accent">{tool.name}</span>
        {tool.intentionSummary && (
          <span className="text-gh-muted truncate">{tool.intentionSummary}</span>
        )}
      </summary>
      <pre className="px-3 py-2 overflow-x-auto text-gh-muted font-mono text-xs border-t border-gh-border whitespace-pre-wrap break-all">
        {preview}
      </pre>
    </details>
  );
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 ${
          isUser
            ? 'bg-gh-accent/20 text-gh-accent'
            : 'bg-gh-active/20 text-gh-active'
        }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            isUser
              ? 'bg-gh-accent/10 border border-gh-accent/20 text-gh-text'
              : 'bg-gh-surface border border-gh-border text-gh-text'
          }`}
        >
          {/* Text content */}
          {message.content.trim() ? (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_pre]:bg-gh-bg [&_pre]:rounded [&_code]:text-gh-accent [&_a]:text-gh-accent">
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            message.toolRequests && message.toolRequests.length > 0 && (
              <span className="text-gh-muted text-xs italic">Using tools…</span>
            )
          )}

          {/* Tool calls */}
          {message.toolRequests && message.toolRequests.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.toolRequests.map((tool) => (
                <ToolCallBlock key={tool.toolCallId} tool={tool} />
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <RelativeTime
          timestamp={message.timestamp}
          className="text-gh-muted text-xs px-1"
        />
      </div>
    </div>
  );
}
