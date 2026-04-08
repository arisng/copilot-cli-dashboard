export interface MessagePreview {
  role: 'user' | 'assistant';
  snippet: string;
  toolNames?: string[];
}

export interface ActiveSubAgent {
  toolCallId: string;
  agentId: string; // The unique agent identifier (e.g., "audit-modules")
  agentName: string;
  agentDisplayName: string;
  description?: string;
  isCompleted: boolean;
  sessionId?: string;
  lastActivityAt?: string;
  model?: string;
}

export type SessionUsageMetricSource =
  | 'shutdown'
  | 'assistant_turn_estimate'
  | 'shutdown_plus_assistant_turn_estimate';

export interface SessionSummary {
  id: string;
  title: string;
  summary: string | null;
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
  totalApiDurationMs: number | null;
  totalApiDurationEstimateMs: number;
  totalApiDurationSource: SessionUsageMetricSource;
  totalPremiumRequests: number | null;
  totalPremiumRequestsEstimate: number;
  totalPremiumRequestsSource: SessionUsageMetricSource;
  currentMode: string;
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
  reasoning?: string;
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

function normalizeTodo(
  todo: Omit<TodoItem, 'description' | 'dependsOn'> & {
    description: string | null;
    dependsOn: string[] | null;
  }
): TodoItem {
  return {
    ...todo,
    description: todo.description ?? '',
    dependsOn: todo.dependsOn ?? [],
  };
}

export interface SessionArtifactEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  modifiedAt: string;
  content?: string;
  children?: SessionArtifactEntry[];
}

export interface SessionArtifactGroup {
  path: 'plan.md' | 'checkpoints' | 'research' | 'files';
  kind: 'file' | 'directory';
  exists: boolean;
  status: 'ok' | 'missing' | 'unreadable';
  message?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  content?: string;
  entries?: SessionArtifactEntry[];
}

export interface SessionArtifacts {
  sessionId: string;
  plan: SessionArtifactGroup;
  folders: SessionArtifactGroup[];
}

export interface SessionDbColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  primaryKeyOrder: number;
}

export interface SessionDbTablePreview {
  name: string;
  type: 'table' | 'view';
  sql: string | null;
  columns: SessionDbColumnInfo[];
  rowCount: number;
  limit: number;
  rows: Array<Record<string, unknown>>;
}

export interface SessionDbInspection {
  sessionId: string;
  databasePath: string;
  availableTables: string[];
  table: SessionDbTablePreview;
}

export interface SearchResult {
  sessionId: string;
  sessionName: string;
  filePath: string;
  fileName: string;
  snippet: string;
  lastModified: string;
}

export interface SessionDetail extends SessionSummary {
  messages: ParsedMessage[];
  subAgentMessages: Record<string, ParsedMessage[]>;
  planContent?: string;
  todos?: TodoItem[];
}

// Workflow topology types
export type WorkflowNodeType = 'user-prompt' | 'assistant-response' | 'tool-call' | 'sub-agent' | 'result';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'error';
  timestamp?: string;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface TurnWorkflow {
  turnId: string;
  turnLabel: string;
  graph: WorkflowGraph;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.text();
      if (body.trim()) {
        message = body;
      }
    } catch {
      // ignore body parsing errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const data = await fetchJson<{ sessions: SessionSummary[] }>('/api/sessions');
  return data.sessions;
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const data = await fetchJson<SessionDetail>(`/api/sessions/${id}`);
  return {
    ...data,
    todos: data.todos?.map(normalizeTodo),
  };
}

export async function fetchSessionArtifacts(id: string): Promise<SessionArtifacts> {
  return fetchJson<SessionArtifacts>(`/api/sessions/${id}/artifacts`);
}

export async function fetchSessionDb(id: string, table?: string, limit = 50): Promise<SessionDbInspection> {
  const params = new URLSearchParams();
  if (table) {
    params.set('table', table);
  }
  params.set('limit', String(limit));

  return fetchJson<SessionDbInspection>(`/api/sessions/${id}/session-db?${params.toString()}`);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchResearch(q: string): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('type', 'research');

  const data = await fetchJson<{ results: SearchResult[] }>(`/api/search?${params.toString()}`);
  return data.results;
}
