import fs from 'fs';
import path from 'path';
import os from 'os';
import type {
  RawEvent,
  SessionSummary,
  SessionDetail,
  SessionCapabilities,
  SessionStartData,
} from './sessionTypes.js';
import { getCurrentMode } from './utils/needsAttention.js';

// ============================================================================
// Discovery
// ============================================================================

const VSCODE_DISCOVERY_TTL_MS = 60_000;

interface VscodeSessionEntry {
  sessionId: string;
  transcriptPath: string;
  workspacePath: string; // path to the workspaceStorage folder
}

interface VscodeDiscoveryCache {
  entries: VscodeSessionEntry[];
  discoveredAt: number;
}

let vscodeDiscoveryCache: VscodeDiscoveryCache | null = null;

function getVscodeWorkspaceStorageRoots(): string[] {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const roots: string[] = [];

  const codePath = path.join(appData, 'Code', 'User', 'workspaceStorage');
  if (fs.existsSync(codePath)) {
    roots.push(codePath);
  }

  const insidersPath = path.join(appData, 'Code - Insiders', 'User', 'workspaceStorage');
  if (fs.existsSync(insidersPath)) {
    roots.push(insidersPath);
  }

  return roots;
}

function parseWorkspaceJson(workspacePath: string): { workspaceUri?: string } | null {
  const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
  if (!fs.existsSync(workspaceJsonPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(workspaceJsonPath, 'utf8');
    const data = JSON.parse(content) as { folder?: string; workspaceUri?: string };
    // VS Code uses `folder`; some variants may use `workspaceUri`
    if (data.folder) {
      return { workspaceUri: data.folder };
    }
    return data;
  } catch {
    return null;
  }
}

function workspaceUriToPath(workspaceUri: string | undefined): string {
  if (!workspaceUri) {
    return 'VS Code';
  }

  // Decode URL-encoded characters (e.g., c%3A -> c:)
  const decoded = decodeURIComponent(workspaceUri);

  // file:///C:/Users/... or file:///home/...
  if (decoded.startsWith('file:///')) {
    let filePath = decoded.slice('file:///'.length);
    // On Windows, the path looks like C:/Users/... — convert to C:\Users\...
    if (/^[A-Za-z]:\//.test(filePath)) {
      filePath = filePath.replace(/\//g, '\\');
    }
    return filePath;
  }

  // WSL paths: file://wsl.localhost/...
  if (decoded.startsWith('file://wsl.localhost/')) {
    return decoded.slice('file://'.length);
  }

  // Remote containers: vscode-remote://... — keep as-is for identification
  if (decoded.startsWith('vscode-remote://')) {
    return decoded;
  }

  return decoded;
}

function discoverVscodeSessions(): VscodeSessionEntry[] {
  const now = Date.now();
  if (vscodeDiscoveryCache && now - vscodeDiscoveryCache.discoveredAt < VSCODE_DISCOVERY_TTL_MS) {
    return vscodeDiscoveryCache.entries;
  }

  const entries: VscodeSessionEntry[] = [];
  const seenSessionIds = new Set<string>();

  for (const root of getVscodeWorkspaceStorageRoots()) {
    let workspaceFolders: string[];
    try {
      workspaceFolders = fs.readdirSync(root);
    } catch {
      continue;
    }

    for (const folder of workspaceFolders) {
      const workspacePath = path.join(root, folder);
      const transcriptDir = path.join(workspacePath, 'GitHub.copilot-chat', 'transcripts');
      if (!fs.existsSync(transcriptDir)) {
        continue;
      }

      let transcriptFiles: string[];
      try {
        transcriptFiles = fs.readdirSync(transcriptDir);
      } catch {
        continue;
      }

      for (const file of transcriptFiles) {
        if (!file.endsWith('.jsonl')) continue;
        const sessionId = file.replace(/\.jsonl$/, '');
        if (seenSessionIds.has(sessionId)) continue;
        seenSessionIds.add(sessionId);

        const transcriptPath = path.join(transcriptDir, file);
        entries.push({ sessionId, transcriptPath, workspacePath });
      }
    }
  }

  vscodeDiscoveryCache = { entries, discoveredAt: now };
  return entries;
}

// ============================================================================
// Event parsing helpers (reuse CLI semantics where possible)
// ============================================================================

function parseEventsFile(filePath: string): RawEvent[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const events: RawEvent[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as RawEvent;
      events.push(event);
    } catch {
      // Skip malformed lines
    }
  }
  return events;
}

function hasShutdownEvent(events: RawEvent[]): boolean {
  return events.some((e) => e.type === 'session.shutdown');
}

function isRootThreadEvent(event: RawEvent, allEvents: RawEvent[]): boolean {
  if (event.parentId === null || event.parentId === undefined) {
    return true;
  }
  // VS Code transcripts chain parentIds: session.start → user.message → assistant.turn_start → ...
  // A root-thread event is one whose parent is the session.start event.
  const parent = allEvents.find((e) => e.id === event.parentId);
  return parent?.type === 'session.start';
}

function normalizeMessageText(text: string): string {
  return text.replace(/<\/?[^>]+>/g, '').trim();
}

function buildPreviewMessages(events: RawEvent[]): import('./sessionTypes.js').MessagePreview[] {
  const previews: import('./sessionTypes.js').MessagePreview[] = [];
  for (const event of events) {
    if (!isRootThreadEvent(event, events)) continue;
    if (event.type === 'user.message') {
      const data = event.data as { content?: string };
      previews.push({
        role: 'user',
        snippet: normalizeMessageText(data.content ?? '').slice(0, 120),
      });
    } else if (event.type === 'assistant.message') {
      const data = event.data as { content?: string; toolRequests?: Array<{ name: string }> };
      previews.push({
        role: 'assistant',
        snippet: normalizeMessageText(data.content ?? '').slice(0, 120),
        toolNames: data.toolRequests?.map((t) => t.name),
      });
    }
    if (previews.length > 2) {
      previews.shift();
    }
  }
  return previews;
}

function titleFromContent(content: string | undefined): string {
  if (!content) return 'Untitled session';
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n')[0] ?? trimmed;
  return firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
}

/**
 * Read the generated title from debug-logs/<sessionId>/title-*.jsonl.
 * VS Code Copilot Chat stores LLM-generated titles in these files.
 * The title is extracted from the agent_response event's response content.
 */
function readVscodeSessionTitle(sessionId: string, workspacePath: string): string | null {
  const debugLogsDir = path.join(workspacePath, 'GitHub.copilot-chat', 'debug-logs', sessionId);
  if (!fs.existsSync(debugLogsDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(debugLogsDir);
    const titleFile = files.find((f) => f.startsWith('title-') && f.endsWith('.jsonl'));
    if (!titleFile) {
      return null;
    }

    const content = fs.readFileSync(path.join(debugLogsDir, titleFile), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as {
          type?: string;
          attrs?: {
            response?: string;
          };
        };
        if (event.type === 'agent_response' && event.attrs?.response) {
          const resp = JSON.parse(event.attrs.response) as Array<{
            parts?: Array<{ content?: string }>;
          }>;
          const title = resp[0]?.parts?.[0]?.content;
          if (title) {
            return title.trim();
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

const VSCODE_CAPABILITIES: SessionCapabilities = {
  supportsInjection: false,
  supportsToolLifecycle: true,
  supportsPlanArtifacts: false,
};

// ============================================================================
// Synthetic status inference for VS Code transcripts
// ============================================================================

/**
 * Derive session status from VS Code transcript events.
 *
 * VS Code transcripts are live append-only logs that often end mid-turn,
 * so CLI heuristics (lastSessionStatus, hasPendingWork) produce false positives.
 * Instead, we synthesize status from explicit signals:
 *
 * - isTaskComplete: true if the current or last completed turn issued
 *   a `task_complete` tool call.
 * - isWorking: true if an assistant turn is open and no task_complete
 *   has been issued in that turn.
 * - needsAttention: true if a pending approval tool (exit_plan_mode,
 *   ask_user, vscode_askQuestions) was started but never completed.
 * - isIdle: true if no turn is open and no task_complete was issued
 *   (rare for VS Code, which usually ends mid-turn).
 */
function computeVscodeSyntheticStatus(events: RawEvent[]): {
  isWorking: boolean;
  isTaskComplete: boolean;
  needsAttention: boolean;
  isIdle: boolean;
  isAborted: boolean;
} {
  let inTurn = false;
  let turnHadTaskComplete = false;
  let lastCompletedTurnHadTaskComplete = false;
  const pendingApprovalTools = new Map<string, string>();

  for (const event of events) {
    if (event.type === 'assistant.turn_start') {
      inTurn = true;
      turnHadTaskComplete = false;
      pendingApprovalTools.clear();
    } else if (event.type === 'assistant.turn_end') {
      inTurn = false;
      lastCompletedTurnHadTaskComplete = turnHadTaskComplete;
      pendingApprovalTools.clear();
    } else if (event.type === 'tool.execution_start') {
      const data = event.data as { toolName?: string; toolCallId?: string };
      if (data.toolName === 'task_complete') {
        turnHadTaskComplete = true;
      }
      if (
        data.toolCallId &&
        ['exit_plan_mode', 'ask_user', 'vscode_askQuestions'].includes(
          data.toolName ?? '',
        )
      ) {
        pendingApprovalTools.set(data.toolCallId, data.toolName ?? '');
      }
    } else if (event.type === 'tool.execution_complete') {
      const data = event.data as { toolCallId?: string };
      if (data.toolCallId) {
        pendingApprovalTools.delete(data.toolCallId);
      }
    } else if (event.type === 'abort') {
      inTurn = false;
      turnHadTaskComplete = false;
      pendingApprovalTools.clear();
    }
  }

  const isTaskComplete = lastCompletedTurnHadTaskComplete || turnHadTaskComplete;
  const needsAttention = pendingApprovalTools.size > 0;
  const isWorking = !isTaskComplete && inTurn;
  const isIdle = !isTaskComplete && !inTurn;

  return { isWorking, isTaskComplete, needsAttention, isIdle, isAborted: false };
}

// ============================================================================
// Summary builder
// ============================================================================

export function listAllVscodeSessions(): SessionSummary[] {
  if (process.env.COPILOT_VSCODE_SESSIONS !== 'true') {
    return [];
  }

  const entries = discoverVscodeSessions();
  const sessions: SessionSummary[] = [];

  for (const entry of entries) {
    const events = parseEventsFile(entry.transcriptPath);
    if (events.length === 0) continue;

    const startEvent = events.find((e) => e.type === 'session.start');
    const startedAt = startEvent
      ? (startEvent.data as unknown as SessionStartData).startTime ?? startEvent.timestamp
      : events[0].timestamp;

    const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;
    const isOpen = !hasShutdownEvent(events);

    // Count user messages and build preview
    let messageCount = 0;
    const previewMessages = buildPreviewMessages(events);
    for (const event of events) {
      if (event.type === 'user.message' && isRootThreadEvent(event, events)) {
        messageCount += 1;
      }
    }

    // Derive project path from workspace.json
    const workspaceData = parseWorkspaceJson(entry.workspacePath);
    const projectPath = workspaceUriToPath(workspaceData?.workspaceUri);

    const firstUserEvent = events.find(
      (e) => e.type === 'user.message' && isRootThreadEvent(e, events)
    );
    const firstUserContent = firstUserEvent
      ? normalizeMessageText((firstUserEvent.data as { content?: string }).content ?? '')
      : undefined;

    const firstAssistantEvent = events.find(
      (e) => e.type === 'assistant.message' && isRootThreadEvent(e, events)
    );
    const firstAssistantContent = firstAssistantEvent
      ? normalizeMessageText((firstAssistantEvent.data as { content?: string }).content ?? '')
      : undefined;

    // Title priority: debug-logs title > user message > assistant message > workspace name > fallback
    const generatedTitle = readVscodeSessionTitle(entry.sessionId, entry.workspacePath);
    const title = generatedTitle
      ?? titleFromContent(firstUserContent)
      ?? titleFromContent(firstAssistantContent)
      ?? titleFromContent(path.basename(projectPath))
      ?? 'Untitled session';

    const currentMode = getCurrentMode(events);
    const syntheticStatus = computeVscodeSyntheticStatus(events);

    const summary: SessionSummary = {
      id: entry.sessionId,
      source: 'vscode',
      title,
      summary: null,
      projectPath,
      gitBranch: null,
      startedAt,
      lastActivityAt,
      durationMs: Date.parse(lastActivityAt) - Date.parse(startedAt),
      isOpen,
      needsAttention: syntheticStatus.needsAttention,
      isWorking: syntheticStatus.isWorking,
      isAborted: syntheticStatus.isAborted,
      isTaskComplete: syntheticStatus.isTaskComplete,
      isIdle: syntheticStatus.isIdle,
      messageCount,
      model: undefined,
      totalApiDurationMs: null,
      totalApiDurationEstimateMs: 0,
      totalApiDurationSource: 'assistant_turn_estimate',
      totalPremiumRequests: null,
      totalPremiumRequestsEstimate: 0,
      totalPremiumRequestsSource: 'assistant_turn_estimate',
      currentMode,
      lastError: null,
      activeSubAgents: [], // VS Code transcripts may not have full sub-agent taxonomy; keep empty
      hasPlan: false,
      isPlanPending: false,
      previewMessages,
      capabilities: VSCODE_CAPABILITIES,
    };

    sessions.push(summary);
  }

  return sessions.sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
  );
}

// ============================================================================
// Detail builder
// ============================================================================

import {
  buildMessages,
  buildActiveSubAgents,
  buildSubAgentMessages,
} from './utils/messageBuilder.js';

export function parseVscodeSessionDir(sessionId: string): SessionDetail | null {
  if (process.env.COPILOT_VSCODE_SESSIONS !== 'true') {
    return null;
  }

  const entries = discoverVscodeSessions();
  const entry = entries.find((e) => e.sessionId === sessionId);
  if (!entry) return null;

  const events = parseEventsFile(entry.transcriptPath);
  if (events.length === 0) {
    return null;
  }

  const startEvent = events.find((e) => e.type === 'session.start');
  const startedAt = startEvent
    ? (startEvent.data as unknown as SessionStartData).startTime ?? startEvent.timestamp
    : events[0].timestamp;

  const isOpen = !hasShutdownEvent(events);
  const messages = buildMessages(events, isOpen);
  const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;

  const activeSubAgents = buildActiveSubAgents(events);
  const subAgentMessages = buildSubAgentMessages(events, activeSubAgents, isOpen);

  const workspaceData = parseWorkspaceJson(entry.workspacePath);
  const projectPath = workspaceUriToPath(workspaceData?.workspaceUri);

  const firstUserEvent = events.find(
    (e) => e.type === 'user.message' && isRootThreadEvent(e, events)
  );
  const firstUserContent = firstUserEvent
    ? normalizeMessageText((firstUserEvent.data as { content?: string }).content ?? '')
    : undefined;

  const firstAssistantEvent = events.find(
    (e) => e.type === 'assistant.message' && isRootThreadEvent(e, events)
  );
  const firstAssistantContent = firstAssistantEvent
    ? normalizeMessageText((firstAssistantEvent.data as { content?: string }).content ?? '')
    : undefined;

  const generatedTitle = readVscodeSessionTitle(sessionId, entry.workspacePath);
  const title = generatedTitle
    ?? titleFromContent(firstUserContent)
    ?? titleFromContent(firstAssistantContent)
    ?? titleFromContent(path.basename(projectPath))
    ?? 'Untitled session';

  const currentMode = getCurrentMode(events);
  const syntheticStatus = computeVscodeSyntheticStatus(events);

  const summary: SessionSummary = {
    id: sessionId,
    source: 'vscode',
    title,
    summary: null,
    projectPath,
    gitBranch: null,
    startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(startedAt),
    isOpen,
    needsAttention: syntheticStatus.needsAttention,
    isWorking: syntheticStatus.isWorking,
    isAborted: syntheticStatus.isAborted,
    isTaskComplete: syntheticStatus.isTaskComplete,
    isIdle: syntheticStatus.isIdle,
    messageCount: messages.filter((m) => m.role === 'user').length,
    model: undefined,
    totalApiDurationMs: null,
    totalApiDurationEstimateMs: 0,
    totalApiDurationSource: 'assistant_turn_estimate',
    totalPremiumRequests: null,
    totalPremiumRequestsEstimate: 0,
    totalPremiumRequestsSource: 'assistant_turn_estimate',
    currentMode,
    lastError: null,
    activeSubAgents,
    hasPlan: false,
    isPlanPending: false,
    previewMessages: buildPreviewMessages(events),
    capabilities: VSCODE_CAPABILITIES,
  };

  return {
    ...summary,
    messages,
    subAgentMessages,
    planContent: undefined,
    todos: undefined,
  };
}
