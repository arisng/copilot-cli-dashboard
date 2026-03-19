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

// Parsed / normalised types used by the API
export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant' | 'task_complete';
  content: string;
  toolRequests?: ToolRequest[];
  timestamp: string;
  interactionId?: string;
}

export interface ActiveSubAgent {
  toolCallId: string;
  agentName: string;
  agentDisplayName: string;
  description?: string;
  isCompleted: boolean;
  sessionId?: string; // sub-agent's own session directory ID
}

export interface SessionSummary {
  id: string;
  title: string;
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
  activeSubAgents: ActiveSubAgent[];
  hasPlan: boolean; // plan.md exists in session directory
  isPlanPending: boolean; // exit_plan_mode has been called and is awaiting user approval
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

export interface SessionDetail extends SessionSummary {
  messages: ParsedMessage[];
  // keyed by task toolCallId — messages that belong to each sub-agent thread
  subAgentMessages: Record<string, ParsedMessage[]>;
  planContent?: string; // contents of plan.md, if present
  todos?: TodoItem[]; // from session.db todos table
}
