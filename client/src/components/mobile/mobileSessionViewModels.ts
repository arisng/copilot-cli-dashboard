import type { ActiveSubAgent, ParsedMessage, TodoItem } from '../../api/client.ts';

type MobileMessageSnippetSource = Pick<ParsedMessage, 'content' | 'reasoning' | 'toolRequests'>;
type MobileTodoToneSource = Pick<TodoItem, 'status'>;
type MobileSubAgentSource = Pick<ActiveSubAgent, 'agentName' | 'agentDisplayName' | 'description'>;

export const MOBILE_MESSAGE_SNIPPET_MAX_LENGTH = 220;

export function getProjectName(projectPath: string): string {
  const normalized = projectPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? projectPath;
}

export function truncateMobileText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function getMessageSnippet(message: MobileMessageSnippetSource): string {
  const toolCount = message.toolRequests?.length ?? 0;
  const source =
    message.content.trim() ||
    message.reasoning?.trim() ||
    (toolCount ? `${toolCount} tool call${toolCount === 1 ? '' : 's'}` : 'No text content');

  return source.replace(/\s+/g, ' ').trim();
}

export function getTodoTone(todo: MobileTodoToneSource): string {
  switch (todo.status) {
    case 'done':
    case 'completed':
      return 'border-gh-active/30 bg-gh-active/10 text-gh-active';
    case 'in_progress':
      return 'border-gh-accent/30 bg-gh-accent/10 text-gh-accent';
    case 'blocked':
      return 'border-gh-attention/30 bg-gh-attention/10 text-gh-attention';
    default:
      return 'border-gh-border bg-gh-surface text-gh-muted';
  }
}

export function formatMobileLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function titleCaseMobileLabel(value: string): string {
  return formatMobileLabel(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getMobileSubAgentLabel(agent: MobileSubAgentSource): string {
  if (agent.agentName === 'read_agent') {
    return `Read · ${agent.description || agent.agentDisplayName || 'Agent'}`;
  }

  return agent.agentDisplayName || agent.agentName;
}
