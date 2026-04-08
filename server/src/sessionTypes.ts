// Raw event record types from ~/.copilot/session-state/<id>/events.jsonl
export interface RawEvent {
  type: string;
  data: Record<string, unknown>;
  id: string;
  timestamp: string;
  parentId: string | null;
}

export interface SessionStartData {
  sessionId: string;
  version: number;
  producer: string;
  copilotVersion: string;
  startTime: string;
  context: {
    cwd: string;
    gitRoot?: string;
    branch?: string;
    headCommit?: string;
    baseCommit?: string;
  };
  alreadyInUse: boolean;
}

export interface UserMessageData {
  content: string;
  transformedContent?: string;
  source: string;
  interactionId: string;
}

export interface AssistantMessageData {
  messageId: string;
  content: string;
  toolRequests?: ToolRequest[];
  interactionId: string;
  outputTokens?: number;
  reasoningText?: string;
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

export interface ToolExecutionCompleteData {
  toolCallId: string;
  toolName: string;
  interactionId: string;
  success: boolean;
  result?: { content: string; detailedContent?: string };
  error?: { message: string; code: string };
}

export interface ShutdownData {
  shutdownType: string;
  totalPremiumRequests: number;
  totalApiDurationMs: number;
  sessionStartTime: number;
  codeChanges?: {
    linesAdded: number;
    linesRemoved: number;
    filesModified: string[];
  };
  modelMetrics?: Record<string, unknown>;
  currentModel?: string;
}

export interface MessagePreview {
  role: 'user' | 'assistant';
  snippet: string;      // first 120 chars of content, stripped of XML tags
  toolNames?: string[]; // names of tool calls in this message (assistant only)
}

// Parsed / normalised types used by the API
export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant' | 'task_complete';
  content: string;
  reasoning?: string;
  toolRequests?: ToolRequest[];
  timestamp: string;
  interactionId?: string;
}

export interface ActiveSubAgent {
  toolCallId: string;
  agentId: string; // The unique agent identifier (e.g., "audit-modules")
  agentName: string;
  agentDisplayName: string;
  description?: string;
  isCompleted: boolean;
  sessionId?: string; // sub-agent's own session directory ID
  lastActivityAt?: string; // ISO 8601 timestamp
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
  isOpen: boolean; // true if an inuse.*.lock file exists (process is running)
  needsAttention: boolean; // open, pending tool execution waiting for user input
  isWorking: boolean; // agent has an open turn in progress
  isAborted: boolean; // last post-user-message action was abort (and agent didn't recover)
  isTaskComplete: boolean; // last post-user-message action was session.task_complete
  isIdle: boolean; // turn ended cleanly, waiting for next user message
  messageCount: number; // user messages only
  model?: string;
  totalApiDurationMs: number | null; // exact when present in session.shutdown
  totalApiDurationEstimateMs: number; // exact shutdown value, or shutdown value plus post-shutdown assistant-turn timing estimate
  totalApiDurationSource: SessionUsageMetricSource;
  totalPremiumRequests: number | null; // exact when present in session.shutdown
  totalPremiumRequestsEstimate: number; // exact shutdown value, or shutdown value plus completed-turn heuristic estimate
  totalPremiumRequestsSource: SessionUsageMetricSource;
  currentMode: string; // 'interactive' | 'plan' | 'auto' — from session.mode_changed events
  activeSubAgents: ActiveSubAgent[];
  hasPlan: boolean; // plan.md exists in session directory
  isPlanPending: boolean; // exit_plan_mode has been called and is awaiting user approval
  previewMessages?: MessagePreview[]; // last 2 messages (1 user + 1 assistant)
}

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
  createdAt: string;
  updatedAt: string;
  dependsOn: string[]; // IDs of todos this depends on
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

export interface SessionDetail extends SessionSummary {
  messages: ParsedMessage[];
  // keyed by task toolCallId — messages that belong to each sub-agent thread
  subAgentMessages: Record<string, ParsedMessage[]>;
  planContent?: string; // contents of plan.md, if present
  todos?: TodoItem[]; // from session.db todos table
}

export interface SearchResult {
  sessionId: string;
  sessionName: string;
  filePath: string;
  fileName: string;
  snippet: string;
  lastModified: string;
}
