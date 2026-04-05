import type { ToolRequest } from '../../api/client.ts';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

// ============================================================================
// Tool Styles
// ============================================================================

const TOOL_STYLES: Record<string, { dot: string; label: string; border: string }> = {
  bash: { dot: 'bg-blue-400', label: 'text-blue-400', border: 'border-blue-400/30' },
  edit: { dot: 'bg-yellow-400', label: 'text-yellow-400', border: 'border-yellow-400/30' },
  view: { dot: 'bg-purple-400', label: 'text-purple-400', border: 'border-purple-400/30' },
  read: { dot: 'bg-purple-400', label: 'text-purple-400', border: 'border-purple-400/30' },
  write: { dot: 'bg-orange-400', label: 'text-orange-400', border: 'border-orange-400/30' },
  task: { dot: 'bg-green-400', label: 'text-green-400', border: 'border-green-400/30' },
  task_complete: { dot: 'bg-green-400', label: 'text-green-400', border: 'border-green-400/30' },
  read_agent: { dot: 'bg-green-400', label: 'text-green-400', border: 'border-green-400/30' },
  ask_user: { dot: 'bg-pink-400', label: 'text-pink-400', border: 'border-pink-400/30' },
};

const DEFAULT_TOOL_STYLE = { dot: 'bg-gh-accent', label: 'text-gh-accent', border: 'border-gh-accent/30' };

const AGENT_TYPE_LABELS: Record<string, string> = {
  explore: 'Explore',
  'general-purpose': 'General',
  Plan: 'Plan',
  'claude-code-guide': 'Guide',
  'code-review': 'Code Review',
  'code-reviewer': 'Code Review',
};

const AGENT_TYPE_COLORS: Record<string, { dot: string; label: string; border: string }> = {
  'code-review': { dot: 'bg-sky-400', label: 'text-sky-400', border: 'border-sky-400/30' },
  'code-reviewer': { dot: 'bg-sky-400', label: 'text-sky-400', border: 'border-sky-400/30' },
};

const DEFAULT_AGENT_COLORS = { dot: 'bg-green-400', label: 'text-green-400', border: 'border-green-400/30' };

// ============================================================================
// Mobile AskUser Block
// ============================================================================

export function MobileAskUserBlock({ tool }: { tool: ToolRequest }) {
  const args = tool.arguments as {
    question?: string;
    message?: string;
    choices?: string[];
    allow_freeform?: boolean;
    requestedSchema?: {
      properties?: Record<string, { enum?: string[]; title?: string; type?: string }>;
      required?: string[];
    };
  };

  const question = args.question ?? args.message ?? '';
  const choices: string[] =
    args.choices ?? Object.values(args.requestedSchema?.properties ?? {}).flatMap((p) => p.enum ?? []);

  const rawAnswer = tool.result?.content ?? '';
  const answer = rawAnswer.replace(/^User (?:selected|responded):\s*/i, '');
  const isPending = !rawAnswer && !tool.error;

  return (
    <div
      className={`rounded-xl border ${isPending ? 'border-pink-400/40 bg-pink-400/5' : 'border-pink-400/20 bg-gh-bg'} overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-pink-400/20">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-pink-400" />
        <span className="text-pink-400 font-medium text-xs">Question</span>
        {isPending && (
          <span className="ml-auto text-xs text-pink-400/70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
            Waiting
          </span>
        )}
      </div>

      {/* Question */}
      {question && (
        <p className="px-3 py-2.5 text-sm text-gh-text leading-relaxed whitespace-pre-wrap">{question}</p>
      )}

      {/* Choices */}
      {choices.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          {choices.map((choice, i) => {
            const isSelected = answer === choice;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${
                  isSelected
                    ? 'border-pink-400/50 bg-pink-400/10 text-gh-text'
                    : answer
                      ? 'border-gh-border/50 bg-gh-surface/50 text-gh-muted'
                      : 'border-gh-border bg-gh-surface text-gh-text'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full border text-xs flex items-center justify-center font-mono ${
                    isSelected ? 'border-pink-400 bg-pink-400/20 text-pink-400' : 'border-gh-border text-gh-muted'
                  }`}
                >
                  {isSelected ? '✓' : String.fromCharCode(65 + i)}
                </span>
                <span className="leading-relaxed text-xs">{choice}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Freeform answer */}
      {answer && !choices.includes(answer) && (
        <div className="px-3 pb-2.5">
          <div className="flex items-start gap-2 rounded-md px-3 py-2 border border-pink-400/30 bg-pink-400/5 text-sm text-gh-text">
            <span className="text-pink-400 text-xs font-medium flex-shrink-0">Answer</span>
            <span className="text-gh-text leading-relaxed text-xs">{answer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Mobile Task Block
// ============================================================================

export function MobileTaskBlock({ tool }: { tool: ToolRequest }) {
  const isReadAgent = tool.name === 'read_agent';
  const args = tool.arguments as {
    agent_type?: string;
    taskDescription?: string;
    prompt?: string;
    mode?: string;
    agent_id?: string;
    wait?: boolean;
  };

  const rawArgs = tool.arguments as Record<string, unknown>;
  const agentDescription: string | undefined = isReadAgent
    ? args.agent_id
    : (rawArgs.description as string | undefined);

  const result = tool.result?.detailedContent ?? tool.result?.content;
  const hasError = !!tool.error;

  const agentType = rawArgs.agent_type as string | undefined;
  const agentLabel = isReadAgent ? 'Read' : agentType ? (AGENT_TYPE_LABELS[agentType] ?? agentType) : 'Agent';

  const colors = AGENT_TYPE_COLORS[agentType ?? ''] ?? DEFAULT_AGENT_COLORS;
  const isDone = !!result || hasError;

  return (
    <details className={`rounded-xl border ${hasError ? 'border-gh-attention/30' : colors.border} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasError ? 'bg-gh-attention' : isDone ? colors.dot : `${colors.dot} animate-pulse`}`}
        />

        {/* Agent type badge */}
        <span
          className={`font-mono font-medium text-xs px-1.5 py-0.5 rounded ${hasError ? 'text-gh-attention' : colors.label}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          {agentLabel}
        </span>

        {/* Sub-agent indicator */}
        {(isReadAgent || tool.name === 'task') && (
          <span className="text-[10px] text-gh-muted/50 font-mono">sub-agent</span>
        )}

        {/* Description */}
        {agentDescription && <span className="text-gh-muted truncate text-xs">{agentDescription}</span>}

        {/* Mode badge */}
        {args.mode && args.mode !== 'sync' && (
          <span className="ml-auto mr-1 text-gh-muted/40 font-mono text-[10px]">{args.mode}</span>
        )}

        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className={`${args.mode ? '' : 'ml-auto'} flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90`}
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className={`border-t ${colors.border} divide-y divide-gh-border/20`}>
        {/* Prompt */}
        {args.prompt && (
          <div>
            <div className={`px-3 py-1.5 ${colors.label}/60 text-[10px] font-medium uppercase tracking-wider border-b border-gh-border/30`}>
              Prompt
            </div>
            <pre className="px-3 py-2 overflow-x-auto font-mono text-xs text-gh-muted whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {args.prompt}
            </pre>
          </div>
        )}

        {/* Result */}
        {(result || hasError) && (
          <div>
            <div
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-b border-gh-border/30 ${hasError ? 'text-gh-attention/60' : `${colors.label}/60`}`}
            >
              {hasError ? 'Error' : 'Result'}
            </div>
            <pre
              className={`px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${hasError ? 'text-gh-attention' : 'text-gh-muted'}`}
            >
              {hasError ? `${tool.error!.message} (${tool.error!.code})` : result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Bash Block
// ============================================================================

export function MobileBashBlock({ tool }: { tool: ToolRequest }) {
  const args = tool.arguments as { command?: string; description?: string; mode?: string; initial_wait?: number };
  const output = tool.result?.detailedContent ?? tool.result?.content;
  const hasError = !!tool.error;

  return (
    <details className={`rounded-xl border ${hasError ? 'border-gh-attention/30' : 'border-blue-400/30'} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasError ? 'bg-gh-attention' : 'bg-blue-400'}`} />
        <span
          className={`font-mono font-medium text-xs px-1.5 py-0.5 rounded ${hasError ? 'text-gh-attention' : 'text-blue-400'}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          bash
        </span>
        {args.description && <span className="text-gh-muted truncate text-xs">{args.description}</span>}
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className={`border-t ${hasError ? 'border-gh-attention/20' : 'border-blue-400/20'}`}>
        {/* Command */}
        <div className="px-3 py-1.5 text-blue-400/60 text-[10px] font-medium uppercase tracking-wider border-b border-gh-border/30 flex items-center gap-2">
          <span>Command</span>
          {args.mode && <span className="text-gh-muted/40 normal-case">· {args.mode}</span>}
        </div>
        <pre className="px-3 py-2 overflow-x-auto font-mono text-xs text-blue-200/80 bg-blue-400/5 whitespace-pre-wrap break-all">
          <span className="select-none text-blue-400/40 mr-1">$</span>
          {args.command}
        </pre>

        {/* Output */}
        {(output || hasError) && (
          <>
            <div
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-t border-b border-gh-border/30 ${hasError ? 'text-gh-attention/60' : 'text-blue-400/60'}`}
            >
              {hasError ? 'Error' : 'Output'}
            </div>
            <pre
              className={`px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${hasError ? 'text-gh-attention' : 'text-gh-muted'}`}
            >
              {hasError ? `${tool.error!.message} (${tool.error!.code})` : output}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Edit Block
// ============================================================================

export function MobileEditBlock({ tool }: { tool: ToolRequest }) {
  const args = tool.arguments as { path?: string; old_str?: string; new_str?: string };
  const fileName = args.path?.split('/').pop() ?? args.path ?? 'file';
  const hasError = !!tool.error;

  return (
    <details className={`rounded-xl border ${hasError ? 'border-gh-attention/30' : 'border-yellow-400/30'} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasError ? 'bg-gh-attention' : 'bg-yellow-400'}`} />
        <span
          className={`font-mono font-medium text-xs px-1.5 py-0.5 rounded ${hasError ? 'text-gh-attention' : 'text-yellow-400'}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          edit
        </span>
        <span className="text-gh-muted font-mono truncate text-xs">{fileName}</span>
        {tool.intentionSummary && <span className="text-gh-muted/70 truncate text-xs hidden sm:inline">{tool.intentionSummary}</span>}
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className="border-t border-yellow-400/20">
        {/* Full path */}
        <div className="px-3 py-1.5 font-mono text-gh-muted/60 text-[10px] border-b border-gh-border/30 truncate">
          {args.path}
        </div>

        {hasError ? (
          <pre className="px-3 py-2 text-gh-attention font-mono text-xs whitespace-pre-wrap break-all">
            {tool.error!.message} ({tool.error!.code})
          </pre>
        ) : (
          <div className="divide-y divide-gh-border/20">
            {/* Removed lines */}
            {args.old_str !== undefined && args.old_str !== '' && (
              <div>
                <div className="px-3 py-1 text-[10px] font-medium text-red-400/60 uppercase tracking-wider bg-red-400/5 border-b border-red-400/10">
                  Removed
                </div>
                <pre className="px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all bg-red-400/5 text-red-300/80 max-h-32 overflow-y-auto">
                  {args.old_str.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      <span className="select-none text-red-400/40 mr-2">−</span>
                      {line}
                    </span>
                  ))}
                </pre>
              </div>
            )}
            {/* Added lines */}
            {args.new_str !== undefined && args.new_str !== '' && (
              <div>
                <div className="px-3 py-1 text-[10px] font-medium text-green-400/60 uppercase tracking-wider bg-green-400/5 border-b border-green-400/10">
                  Added
                </div>
                <pre className="px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all bg-green-400/5 text-green-300/80 max-h-32 overflow-y-auto">
                  {args.new_str.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      <span className="select-none text-green-400/40 mr-2">+</span>
                      {line}
                    </span>
                  ))}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Reasoning Block
// ============================================================================

export function MobileReasoningBlock({ text }: { text: string }) {
  return (
    <details className="rounded-xl border border-amber-400/20 bg-amber-400/5 text-xs group mb-2">
      <summary className="px-3 py-2 cursor-pointer list-none flex items-center gap-2 hover:bg-amber-400/5 transition-colors min-h-[44px]">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="text-amber-400/70 flex-shrink-0">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3H7v-1.5h2V11zm0-3H7c0-2.5 3-2.5 3-4a2 2 0 10-4 0H4a4 4 0 118 0c0 2.3-3 2.5-3 4z" />
        </svg>
        <span className="text-amber-400/70 font-medium uppercase tracking-wider text-xs">Thinking</span>
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-amber-400/40 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>
      <div className="border-t border-amber-400/15 px-3 py-2.5">
        <p className="text-amber-200/60 text-xs leading-relaxed whitespace-pre-wrap italic">{text}</p>
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Atlassian Summary (simplified for mobile)
// ============================================================================

const ATLASSIAN_META: Record<string, { product: 'confluence' | 'jira'; action: string; summary: (args: Record<string, unknown>) => string }> = {
  'mcp-atlassian-confluence_get_page': { product: 'confluence', action: 'Get Page', summary: (a) => String(a.page_id ?? '') },
  'mcp-atlassian-confluence_get_page_children': { product: 'confluence', action: 'Get Children', summary: (a) => `parent ${a.parent_id}` },
  'mcp-atlassian-confluence_create_page': { product: 'confluence', action: 'Create Page', summary: (a) => String(a.title ?? '') },
  'mcp-atlassian-confluence_update_page': { product: 'confluence', action: 'Update Page', summary: (a) => String(a.title ?? a.page_id ?? '') },
  'mcp-atlassian-confluence_search': { product: 'confluence', action: 'Search', summary: (a) => String(a.query ?? '') },
  'mcp-atlassian-jira_get_issue': { product: 'jira', action: 'Get Issue', summary: (a) => String(a.issue_key ?? '') },
  'mcp-atlassian-jira_get_issue_development_info': { product: 'jira', action: 'Dev Info', summary: (a) => String(a.issue_key ?? '') },
  'mcp-atlassian-jira_get_issue_images': { product: 'jira', action: 'Issue Images', summary: (a) => String(a.issue_key ?? '') },
  'mcp-atlassian-jira_add_comment': { product: 'jira', action: 'Add Comment', summary: (a) => String(a.issue_key ?? '') },
  'mcp-atlassian-jira_download_attachments': { product: 'jira', action: 'Download Attachments', summary: (a) => String(a.issue_key ?? '') },
  'mcp-atlassian-jira_search': { product: 'jira', action: 'Search', summary: (a) => String(a.jql ?? '') },
};

export function MobileAtlassianSummary({ tool }: { tool: ToolRequest }) {
  const meta = ATLASSIAN_META[tool.name];
  if (!meta) return <MobileGenericToolBlock tool={tool} />;

  const args = tool.arguments as Record<string, unknown>;
  const isConfluence = meta.product === 'confluence';
  const hasError = !!tool.error;
  const result = tool.result?.detailedContent ?? tool.result?.content;
  const summaryText = meta.summary(args);
  const isDone = !!result || hasError;

  const color = isConfluence
    ? { dot: 'bg-blue-400', label: 'text-blue-400', border: 'border-blue-400/30', badge: 'bg-blue-400/10 text-blue-400' }
    : { dot: 'bg-indigo-400', label: 'text-indigo-400', border: 'border-indigo-400/30', badge: 'bg-indigo-400/10 text-indigo-400' };

  return (
    <details className={`rounded-xl border ${hasError ? 'border-gh-attention/30' : color.border} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasError ? 'bg-gh-attention' : isDone ? color.dot : `${color.dot} animate-pulse`}`} />
        <span className={`font-medium text-xs px-1.5 py-0.5 rounded ${hasError ? 'bg-gh-attention/10 text-gh-attention' : color.badge}`}>
          {isConfluence ? 'Confluence' : 'Jira'}
        </span>
        <span className={`font-mono font-medium ${hasError ? 'text-gh-attention' : color.label}`}>{meta.action}</span>
        {summaryText && <span className="text-gh-muted truncate text-xs">{summaryText}</span>}
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className={`border-t ${color.border}`}>
        {/* Key args */}
        {(() => {
          const displayArgs = Object.entries(args).filter(([k, v]) => k !== 'content' && v != null && String(v) !== '');
          return displayArgs.length > 0 ? (
            <div className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {displayArgs.map(([k, v]) => (
                <div key={k} className="contents">
                  <span className={`${color.label}/60 font-medium uppercase tracking-wide text-[10px] leading-5 whitespace-nowrap`}>
                    {k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-gh-muted font-mono text-xs leading-5 truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : null;
        })()}

        {/* Result */}
        {(result || hasError) && (
          <div className="border-t border-gh-border/30">
            <div className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${hasError ? 'text-gh-attention/60' : `${color.label}/60`}`}>
              {hasError ? 'Error' : 'Result'}
            </div>
            <pre
              className={`px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${hasError ? 'text-gh-attention' : 'text-gh-muted'}`}
            >
              {hasError ? `${tool.error!.message} (${tool.error!.code})` : result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Figma Summary (simplified for mobile)
// ============================================================================

const FIGMA_TOOL_META: Record<string, { action: string }> = {
  'figma-get_screenshot': { action: 'Screenshot' },
  'figma-get_design_context': { action: 'Design Context' },
  'figma-get_metadata': { action: 'Metadata' },
};

export function MobileFigmaSummary({ tool }: { tool: ToolRequest }) {
  const meta = FIGMA_TOOL_META[tool.name] ?? { action: tool.name.replace('figma-', '').replace(/_/g, ' ') };
  const args = tool.arguments as { nodeId?: string; clientLanguages?: string; clientFrameworks?: string; artifactType?: string };
  const nodeId = args.nodeId;
  const hasError = !!tool.error;
  const isDone = !!tool.result || hasError;

  const color = { dot: 'bg-violet-400', label: 'text-violet-400', border: 'border-violet-400/30', badge: 'bg-violet-400/10 text-violet-400' };

  return (
    <details className={`rounded-xl border ${hasError ? 'border-gh-attention/30' : color.border} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasError ? 'bg-gh-attention' : isDone ? color.dot : `${color.dot} animate-pulse`}`} />
        <span className={`font-medium text-xs px-1.5 py-0.5 rounded ${hasError ? 'bg-gh-attention/10 text-gh-attention' : color.badge}`}>Figma</span>
        <span className={`font-mono font-medium ${hasError ? 'text-gh-attention' : color.label}`}>{meta.action}</span>
        {nodeId ? (
          <span className="text-gh-muted font-mono truncate text-xs" title={nodeId}>
            #{nodeId.slice(0, 20)}
          </span>
        ) : (
          <span className="text-gh-muted/40 italic text-xs">no node</span>
        )}
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className={`border-t ${color.border}`}>
        {/* Details */}
        {(args.clientFrameworks || args.clientLanguages || args.artifactType) && (
          <div className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {args.clientFrameworks && (
              <>
                <span className={`${color.label}/60 font-medium uppercase tracking-wide text-[10px] leading-5 whitespace-nowrap`}>
                  Frameworks
                </span>
                <span className="text-gh-muted font-mono text-xs leading-5">{args.clientFrameworks}</span>
              </>
            )}
            {args.clientLanguages && (
              <>
                <span className={`${color.label}/60 font-medium uppercase tracking-wide text-[10px] leading-5 whitespace-nowrap`}>
                  Languages
                </span>
                <span className="text-gh-muted font-mono text-xs leading-5">{args.clientLanguages}</span>
              </>
            )}
            {args.artifactType && (
              <>
                <span className={`${color.label}/60 font-medium uppercase tracking-wide text-[10px] leading-5 whitespace-nowrap`}>
                  Artifact
                </span>
                <span className="text-gh-muted font-mono text-xs leading-5">{args.artifactType.replace(/_/g, ' ').toLowerCase()}</span>
              </>
            )}
          </div>
        )}

        {/* Result */}
        {(tool.result?.content || hasError) && (
          <div className="border-t border-gh-border/30">
            <div className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${hasError ? 'text-gh-attention/60' : `${color.label}/60`}`}>
              {hasError ? 'Error' : 'Result'}
            </div>
            <pre
              className={`px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${hasError ? 'text-gh-attention' : 'text-gh-muted'}`}
            >
              {hasError ? `${tool.error!.message} (${tool.error!.code})` : tool.result!.content}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Mobile Generic Tool Block
// ============================================================================

export function MobileGenericToolBlock({ tool }: { tool: ToolRequest }) {
  const argsStr = JSON.stringify(tool.arguments, null, 2);
  const output = tool.result?.detailedContent ?? tool.result?.content;
  const style = tool.error
    ? { dot: 'bg-gh-attention', label: 'text-gh-attention', border: 'border-gh-attention/30' }
    : TOOL_STYLES[tool.name] ?? DEFAULT_TOOL_STYLE;

  return (
    <details className={`rounded-xl border ${style.border} bg-gh-bg text-xs group`}>
      <summary className="px-3 py-2.5 cursor-pointer list-none flex items-center gap-2 hover:bg-white/5 transition-colors min-h-[44px]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
        <span
          className={`font-mono font-medium text-xs px-1.5 py-0.5 rounded ${style.label}`}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          {tool.name}
        </span>
        {tool.intentionSummary && <span className="text-gh-muted truncate text-xs">{tool.intentionSummary}</span>}
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="currentColor"
          className="ml-auto flex-shrink-0 text-gh-muted/50 transition-transform group-open:rotate-90"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </summary>

      <div className={`border-t ${style.border}`}>
        {/* Input */}
        <div className="px-3 py-1.5 text-gh-muted/50 text-[10px] font-medium uppercase tracking-wider border-b border-gh-border/30">
          Input
        </div>
        <pre className="px-3 py-2 overflow-x-auto text-gh-muted font-mono text-xs whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {argsStr}
        </pre>

        {/* Output */}
        {(output || tool.error) && (
          <>
            <div
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-t border-b border-gh-border/30 ${tool.error ? 'text-gh-attention/60' : 'text-gh-muted/50'}`}
            >
              {tool.error ? 'Error' : 'Output'}
            </div>
            <pre
              className={`px-3 py-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${tool.error ? 'text-gh-attention' : 'text-gh-muted'}`}
            >
              {tool.error ? `${tool.error.message} (${tool.error.code})` : output}
            </pre>
          </>
        )}
      </div>
    </details>
  );
}

// ============================================================================
// Tool Block Renderer
// ============================================================================

export function MobileToolBlock({ tool }: { tool: ToolRequest }) {
  if (tool.name === 'ask_user') {
    return <MobileAskUserBlock tool={tool} />;
  }

  if (tool.name === 'task' || tool.name === 'task_complete' || tool.name === 'read_agent') {
    return <MobileTaskBlock tool={tool} />;
  }

  if (tool.name === 'bash') {
    return <MobileBashBlock tool={tool} />;
  }

  if (tool.name === 'edit') {
    return <MobileEditBlock tool={tool} />;
  }

  if (tool.name.startsWith('mcp-atlassian-')) {
    return <MobileAtlassianSummary tool={tool} />;
  }

  if (tool.name.startsWith('figma-')) {
    return <MobileFigmaSummary tool={tool} />;
  }

  return <MobileGenericToolBlock tool={tool} />;
}
