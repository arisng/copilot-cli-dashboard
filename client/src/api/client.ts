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
  // Extended properties for workflow topology
  modelInfo?: { name: string; source: string };
  status?: { scope: 'worker' | 'session' };
  dispatch?: { toolName: string; family: string; toolCallId: string };
  agent?: { targetName: string; targetKind: string; instanceId: string };
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
export type WorkflowNodeType =
  | 'user-prompt'
  | 'main-agent'
  | 'tool-call'      // Now includes agent-management family tools (task, read_agent)
  | 'sub-agent'      // True background subagents only (async background tasks)
  | 'detached-shell' // NEW: Detached shell sessions
  | 'result';

// Normalized metadata for workflow nodes (AMTP Animal phase taxonomy)
export interface WorkflowNodeDispatchMetadata {
  toolName: string;
  family: 'agent-management' | 'orchestration' | 'tool' | string;
  toolCallId: string;
}

export interface WorkflowNodeAgentMetadata {
  targetName: string;
  targetKind: string;
  instanceId: string;
}

export interface WorkflowNodeModelMetadata {
  name: string | null;
  source: string | null;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  agentType?: string;      // Displayed prominently (e.g., 'coder', 'explorer', 'orchestrator')
  agentName?: string;      // Custom agent name from args.name
  model?: string;
  description?: string;
  roundIndex?: number;
  isMainAgent?: boolean;
  metadata?: {
    toolCallId?: string;
    toolName?: string;
    dispatch?: WorkflowNodeDispatchMetadata;
    agent?: WorkflowNodeAgentMetadata;
    model?: WorkflowNodeModelMetadata;
    // Dispatch mode from original tool args (e.g., 'background' vs 'sync')
    backgroundMode?: boolean;
    // NEW: Background execution info
    backgroundInfo?: {
      processId?: string;
      detached: boolean;
      shellSession?: boolean;
    };
  };
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

// === AMTP Plan API Types ===

export interface SessionActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GCStatus {
  enabled: boolean;
  running: boolean;
  intervalHours: number;
}

export interface GCResult {
  scanned: number;
  archived: number;
  deleted: number;
  bytesReclaimed: number;
  errors: string[];
}

export interface SessionSearchResult {
  sessionId: string;
  content: string;
  sourceType: string;
  sourceId: string;
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

// === Session Action API Functions ===

const API_BASE = '/api';

export async function injectMessage(sessionId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<SessionActionResult> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, role }),
  });
  if (!res.ok) throw new Error(`Failed to inject message: ${res.status}`);
  return res.json();
}

// === Admin/GC API Functions ===

export async function getGCStatus(): Promise<GCStatus> {
  const res = await fetch(`${API_BASE}/admin/gc-status`);
  if (!res.ok) throw new Error(`Failed to get GC status: ${res.status}`);
  return res.json();
}

export async function runGC(dryRun = false): Promise<GCResult> {
  const res = await fetch(`${API_BASE}/admin/gc-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  });
  if (!res.ok) throw new Error(`Failed to run GC: ${res.status}`);
  return res.json();
}

// === Session Search API Function ===

export async function searchSessions(query: string): Promise<SessionSearchResult[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
