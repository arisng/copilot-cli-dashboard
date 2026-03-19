import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useSession } from '../../hooks/useSession.ts';
import { LoadingSpinner } from '../shared/LoadingSpinner.tsx';
import { SessionMeta } from './SessionMeta.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import type { ActiveSubAgent, ParsedMessage, TodoItem } from '../../api/client.ts';

// ── Plan markdown components ───────────────────────────────────────────────

const planComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-gh-text border-b border-gh-border pb-2 mb-4 mt-6 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-gh-accent mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-gh-text uppercase tracking-wide mt-4 mb-1.5 opacity-80">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gh-text leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 mb-3 pl-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-3 pl-0 list-none counter-reset-[item]">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    // Detect task list items (checkboxes)
    const childArr = Array.isArray(children) ? children : [children];
    const hasCheckbox = childArr.some(
      (c) => typeof c === 'object' && c !== null && (c as React.ReactElement)?.type === 'input'
    );
    if (hasCheckbox) {
      return (
        <li className="flex items-start gap-2 text-sm text-gh-text py-0.5" {...props}>{children}</li>
      );
    }
    return (
      <li className="flex items-start gap-2 text-sm text-gh-text py-0.5 before:content-['›'] before:text-gh-accent before:font-bold before:shrink-0 before:mt-px" {...props}>{children}</li>
    );
  },
  input: ({ type, checked }) => {
    if (type === 'checkbox') {
      return (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 mt-0.5 ${
          checked ? 'bg-gh-active border-gh-active text-white' : 'border-gh-border bg-gh-surface'
        }`}>
          {checked && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            </svg>
          )}
        </span>
      );
    }
    return <input type={type} readOnly />;
  },
  code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
    inline ? (
      <code className="text-xs font-mono bg-gh-surface text-gh-accent px-1.5 py-0.5 rounded border border-gh-border/50">{children}</code>
    ) : (
      <code>{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-gh-surface border border-gh-border rounded-lg p-3 overflow-x-auto text-xs font-mono text-gh-text mb-3 leading-relaxed">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gh-accent/50 pl-3 text-gh-muted italic text-sm mb-3">{children}</blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gh-text">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-gh-accent hover:underline" target="_blank" rel="noreferrer">{children}</a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gh-surface">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-gh-muted font-medium border border-gh-border">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gh-text border border-gh-border">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-gh-surface/30">{children}</tr>,
  hr: () => <hr className="border-gh-border my-4" />,
};

// ── Plan view ──────────────────────────────────────────────────────────────

function PlanView({ content, isPending }: { content: string; isPending: boolean }) {
  return (
    <div>
      {isPending && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gh-attention/30 bg-gh-attention/10 text-gh-attention text-sm">
          <span className="w-2 h-2 rounded-full bg-gh-attention animate-pulse shrink-0" />
          <span className="font-medium">Waiting for your approval</span>
          <span className="text-gh-attention/70 text-xs">· Review the plan below and approve or reject it in your terminal</span>
        </div>
      )}
      <div className="p-6 max-h-[calc(100vh-360px)] overflow-y-auto">
        <Markdown remarkPlugins={[remarkGfm]} components={planComponents}>{content}</Markdown>
      </div>
    </div>
  );
}

// ── Todos view ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  completed:   { label: 'Done',        dot: 'bg-gh-active',     text: 'text-gh-active' },
  in_progress: { label: 'In progress', dot: 'bg-gh-accent animate-pulse', text: 'text-gh-accent' },
  pending:     { label: 'Pending',     dot: 'bg-gh-muted',      text: 'text-gh-muted' },
  cancelled:   { label: 'Cancelled',   dot: 'bg-gh-attention',  text: 'text-gh-attention' },
};

function TodosView({ todos }: { todos: TodoItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const pending   = todos.filter((t) => t.status === 'pending');
  const active    = todos.filter((t) => t.status === 'in_progress');
  const done      = todos.filter((t) => t.status === 'completed' || t.status === 'cancelled');
  const groups = [
    { label: 'In progress', items: active,  accent: 'text-gh-accent' },
    { label: 'Pending',     items: pending, accent: 'text-gh-muted' },
    { label: 'Done',        items: done,    accent: 'text-gh-muted' },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="p-4 max-h-[calc(100vh-360px)] overflow-y-auto space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${group.accent}`}>
            {group.label} · {group.items.length}
          </p>
          <div className="space-y-1.5">
            {group.items.map((todo) => {
              const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.pending;
              const isExpanded = expanded.has(todo.id);
              return (
                <div
                  key={todo.id}
                  className="rounded-lg border border-gh-border bg-gh-surface/30 overflow-hidden"
                >
                  <button
                    onClick={() => toggle(todo.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gh-surface/60 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-sm text-gh-text font-medium flex-1 leading-snug">{todo.title}</span>
                    {todo.dependsOn.length > 0 && (
                      <span className="text-xs text-gh-muted shrink-0">{todo.dependsOn.length} dep{todo.dependsOn.length !== 1 ? 's' : ''}</span>
                    )}
                    <svg
                      viewBox="0 0 16 16" width="10" height="10" fill="currentColor"
                      className={`text-gh-muted shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gh-border/50 pt-2 space-y-2">
                      <p className="text-xs text-gh-muted leading-relaxed">{todo.description}</p>
                      {todo.dependsOn.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gh-muted">Depends on:</span>
                          {todo.dependsOn.map((dep) => (
                            <span key={dep} className="text-xs font-mono bg-gh-bg border border-gh-border rounded px-1.5 py-0.5 text-gh-muted">{dep}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {todos.length === 0 && (
        <p className="text-center text-gh-muted text-sm py-8">No todos yet.</p>
      )}
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  isCompleted?: boolean;
  isSubAgent: boolean;
  isPlan?: boolean;
  isTodos?: boolean;
  agent?: ActiveSubAgent;
}

function TabBar({ tabs, activeId, onChange }: { tabs: Tab[]; activeId: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-end border-b border-gh-border overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors
              ${isActive
                ? 'border-gh-accent text-gh-text bg-gh-surface'
                : 'border-transparent text-gh-muted hover:text-gh-text hover:bg-gh-surface/50'
              }
            `}
          >
            {tab.isPlan && (
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="shrink-0 text-gh-attention">
                <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.744 3.744 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75zm7.251 10.324l.022-.067v-8.51c-.09-.198-.2-.37-.33-.517A2.25 2.25 0 005.003 2.5H1.5v9.013h3.757a3.75 3.75 0 012-.689zm1.499-8.577v8.51l.022.068a3.75 3.75 0 012-.711H14.5V2.5h-3.244a2.25 2.25 0 00-1.852.979c-.13.148-.24.32-.154.518z"/>
              </svg>
            )}
            {tab.isTodos && (
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" className="shrink-0 text-gh-active">
                <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 010 1.5H2.75A1.75 1.75 0 011 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 01-1.5 0V1.75a.25.25 0 00-.25-.25h-8.5a.25.25 0 00-.25.25zm11.03 9.58a.75.75 0 10-1.06-1.06l-2.97 2.97-1.22-1.22a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.5-3.5zM4.75 4a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm-.75 3.75A.75.75 0 014.75 7h2a.75.75 0 010 1.5h-2A.75.75 0 014 7.75z"/>
              </svg>
            )}
            {tab.isSubAgent && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-gh-accent/15 text-gh-accent shrink-0">
                <svg viewBox="0 0 16 16" width="9" height="9" fill="currentColor">
                  <path d="M1.5 1.75a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75a.25.25 0 01-.25-.25zM1.5 8a.25.25 0 01.25-.25h12.5a.25.25 0 010 .5H1.75A.25.25 0 011.5 8zm.25 5.75a.25.25 0 000 .5h12.5a.25.25 0 000-.5H1.75z"/>
                </svg>
              </span>
            )}
            <span>{tab.label}</span>
            {tab.isPlan && (
              <span className="w-1.5 h-1.5 rounded-full bg-gh-attention animate-pulse shrink-0" />
            )}
            {tab.isSubAgent && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                tab.isCompleted ? 'bg-gh-muted' : 'bg-gh-active animate-pulse'
              }`} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Message list ───────────────────────────────────────────────────────────

function MessageList({ messages, maxHeight }: { messages: ParsedMessage[]; maxHeight: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages.length]);

  if (messages.length === 0) {
    return <div className="p-8 text-center text-gh-muted text-sm">No messages yet.</div>;
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight }}>
      {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, error } = useSession(id ?? '');
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => { setActiveTab('main'); }, [id]);

  // Auto-switch to plan tab when plan is pending approval (only on first load)
  useEffect(() => {
    if (session?.isPlanPending && activeTab === 'main') setActiveTab('plan');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.isPlanPending]);

  if (loading && !session) return <LoadingSpinner />;
  if (error) return (
    <div className="rounded-lg border border-gh-attention/30 bg-gh-attention/10 p-4 text-gh-attention text-sm">{error}</div>
  );
  if (!session) return null;

  const subAgents = [...(session.activeSubAgents ?? [])].reverse(); // newest first
  const hasPlan  = !!session.planContent;
  const hasTodos = (session.todos?.length ?? 0) > 0;
  const hasTabs  = hasPlan || hasTodos || subAgents.length > 0;

  const tabs: Tab[] = [
    { id: 'main',  label: 'Main',  isSubAgent: false },
    ...(hasPlan  ? [{ id: 'plan',  label: 'Plan',  isSubAgent: false, isPlan: session.isPlanPending }] : []),
    ...(hasTodos ? [{ id: 'todos', label: 'Todos', isSubAgent: false, isTodos: true }] : []),
    ...subAgents.map((a) => ({
      id: a.toolCallId,
      label: a.agentName === 'read_agent'
        ? `Read · ${a.agentDisplayName || a.description || 'Agent'}`
        : (a.agentDisplayName || a.agentName),
      isCompleted: a.isCompleted,
      isSubAgent: true,
      agent: a,
    })),
  ];

  const activeAgent    = tabs.find((t) => t.id === activeTab)?.agent;
  const activeMessages = activeTab === 'main'
    ? session.messages
    : (session.subAgentMessages?.[activeTab] ?? []);

  return (
    <div>
      <SessionMeta session={session} />

      <div className="rounded-lg border border-gh-border overflow-hidden">
        {hasTabs && <TabBar tabs={tabs} activeId={activeTab} onChange={setActiveTab} />}

        {/* Plan */}
        {activeTab === 'plan' && session.planContent && (
          <PlanView content={session.planContent} isPending={session.isPlanPending} />
        )}

        {/* Todos */}
        {activeTab === 'todos' && session.todos && (
          <TodosView todos={session.todos} />
        )}

        {/* Sub-agent context bar */}
        {activeTab !== 'plan' && activeTab !== 'todos' && activeAgent && (
          <div className="px-4 py-2 border-b border-gh-border bg-gh-surface/50 flex items-center gap-2 text-xs">
            <span className="text-gh-muted">Sub-agent</span>
            <span className="font-mono text-gh-text font-medium">{activeAgent.agentDisplayName || activeAgent.agentName}</span>
            {activeAgent.description && (
              <><span className="text-gh-border">·</span><span className="text-gh-muted truncate">{activeAgent.description}</span></>
            )}
            <span className="ml-auto shrink-0">
              {activeAgent.isCompleted
                ? <span className="inline-flex items-center gap-1 text-gh-muted"><span className="w-1.5 h-1.5 rounded-full bg-gh-muted" />Done</span>
                : <span className="inline-flex items-center gap-1 text-gh-active"><span className="w-1.5 h-1.5 rounded-full bg-gh-active animate-pulse" />Running</span>
              }
            </span>
          </div>
        )}

        {activeTab !== 'plan' && activeTab !== 'todos' && (
          <MessageList
            messages={activeMessages}
            maxHeight={hasTabs ? 'calc(100vh - 360px)' : 'calc(100vh - 280px)'}
          />
        )}
      </div>
    </div>
  );
}
