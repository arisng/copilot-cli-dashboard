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
  messageCount: number;
  model?: string;
}

export interface ToolRequest {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  type: string;
  toolTitle?: string;
  intentionSummary?: string;
}

export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolRequests?: ToolRequest[];
  timestamp: string;
  interactionId?: string;
}

export interface SessionDetail extends SessionSummary {
  messages: ParsedMessage[];
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
