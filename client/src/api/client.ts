export interface MessagePreview {
  role: 'user' | 'assistant';
  snippet: string;
  toolNames?: string[];
}

export interface ActiveSubAgent {
  toolCallId: string;
  agentName: string;
  agentDisplayName: string;
  description?: string;
  isCompleted: boolean;
  sessionId?: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  projectPath: string;
  gitBranch: string | null;
  startedAt: string;
  lastActivityAt: string;
  durationMs: number;
  isOpen: boolean;
  needsAttention: boolean;
  isWorking: boolean;
  isAborted: boolean;
  isTaskComplete: boolean;
  isIdle: boolean;
  messageCount: number;
  model?: string;
  activeSubAgents: ActiveSubAgent[];
  hasPlan: boolean;
  isPlanPending: boolean;
  previewMessages?: MessagePreview[];
}

export interface ToolRequest {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  type: string;
  toolTitle?: string;
  intentionSummary?: string;
  result?: { content: string; detailedContent?: string };
  error?: { message: string; code: string };
}

export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant' | 'task_complete';
  content: string;
  toolRequests?: ToolRequest[];
  timestamp: string;
  interactionId?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  dependsOn: string[];
}

export interface SessionDetail extends SessionSummary {
  messages: ParsedMessage[];
  subAgentMessages: Record<string, ParsedMessage[]>;
  planContent?: string;
  todos?: TodoItem[];
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return data.sessions;
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
