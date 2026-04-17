import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import yaml from 'js-yaml';
import type {
  RawEvent,
  SessionContextData,
  SessionErrorData,
  SessionEventError,
  SessionResumeData,
  SessionStartData,
  UserMessageData,
  AssistantMessageData,
  SystemNotificationData,
  ToolExecutionCompleteData,
  ShutdownData,
  ParsedMessage,
  MessagePreview,
  SessionSummary,
  SessionDetail,
  ActiveSubAgent,
  TodoItem,
  SessionUsageMetricSource,
  SessionArtifactEntry,
  SessionArtifactGroup,
  SessionArtifacts,
  SessionDbColumnInfo,
  SessionDbInspection,
  SessionDbTablePreview,
  DispatchInfo,
  AgentIdentity,
  ModelInfo,
  StatusInfo,
} from './sessionTypes.js';
import { needsAttention, lastSessionStatus, hasPendingWork, hasPendingPlanApproval, getCurrentMode } from './utils/needsAttention.js';
import {
  isCatalogAvailable,
  querySessionsFromCatalog,
  searchAcrossSessions,
  type CatalogSession,
  detectDiscrepancies,
} from './utils/catalogSearch.js';
import {
  buildMessages,
  buildActiveSubAgents,
  buildSubAgentMessages,
} from './utils/messageBuilder.js';
import {
  listAllVscodeSessions,
  parseVscodeSessionDir,
} from './vscodeSessionReader.js';

const DEFAULT_SESSION_ROOT = path.join(os.homedir(), '.copilot', 'session-state');
const ROOT_DISCOVERY_TTL_MS = 30_000;

type SessionRootsCache = {
  configuredRootsKey: string | null;
  roots: string[];
  discoveredAt: number;
};

type SessionSummaryScan = {
  reducerEvents: RawEvent[];
  eventCount: number;
  startData?: SessionStartData;
  latestContext?: SessionContextData;
  startedAt?: string;
  shutdownData?: ShutdownData;
  lastShutdownAt?: string;
  lastModelChange?: string;
  lastResumeModel?: string;
  lastError?: SessionEventError | null;
  lastActivityAt?: string;
  firstUserContent?: string;
  messageCount: number;
  previewMessages: MessagePreview[];
};

type CachedSessionSummary = {
  signature: string;
  summary: SessionSummary | null;
};

type SessionUsageMetrics = {
  totalApiDurationMs: number | null;
  totalApiDurationEstimateMs: number;
  totalApiDurationSource: SessionUsageMetricSource;
  totalPremiumRequests: number | null;
  totalPremiumRequestsEstimate: number;
  totalPremiumRequestsSource: SessionUsageMetricSource;
};

type SessionArtifactSectionName = 'checkpoints' | 'research' | 'files';
type SqliteDatabase = ReturnType<typeof Database>;

let sessionRootsCache: SessionRootsCache | null = null;
const sessionSummaryCache = new Map<string, CachedSessionSummary>();
const SESSION_ARTIFACT_SECTIONS: SessionArtifactSectionName[] = ['checkpoints', 'research', 'files'];

const ALLOWED_ARTIFACT_PREFIXES = ['files/', 'checkpoints/', 'research/', 'plan.md'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const EXCLUDED_DIRECTORY_NAMES = ['node_modules', 'bin', 'obj', 'dist', 'build', '.git', '.svn', '.hg', '.next', '.nuxt', 'out', 'coverage', '.cache', 'tmp', 'temp'];

export function isImageFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function getMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.svg')) return 'image/svg+xml';
  if (lowerName.endsWith('.bmp')) return 'image/bmp';
  if (lowerName.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function isPathWithinAllowedArtifacts(filePath: string): boolean {
  // Normalize the path and check for traversal attempts
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  
  // Reject paths with .. components
  if (normalized.includes('..')) {
    return false;
  }
  
  // Must start with one of the allowed prefixes
  return ALLOWED_ARTIFACT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export interface ArtifactFileResult {
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
}

export function readSessionArtifactFile(sessionId: string, relativePath: string): ArtifactFileResult | null {
  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) return null;

  // Validate the path is within allowed artifact directories
  if (!isPathWithinAllowedArtifacts(relativePath)) {
    throw new Error('Path outside allowed artifact directories');
  }

  const fullPath = path.join(sessionDir, relativePath);
  
  // Extra safety: ensure resolved path is within session directory
  const resolvedPath = path.resolve(fullPath);
  const resolvedSessionDir = path.resolve(sessionDir);
  if (!resolvedPath.startsWith(resolvedSessionDir)) {
    throw new Error('Path traversal detected');
  }

  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return null;
    }

    const content = fs.readFileSync(fullPath);
    const fileName = path.basename(fullPath);
    
    return {
      filePath: relativePath,
      mimeType: getMimeType(fileName),
      sizeBytes: stat.size,
      content,
    };
  } catch {
    return null;
  }
}
const SESSION_DB_PREVIEW_LIMIT = 100;

export class SessionDbInspectionError extends Error {
  code: 'missing_db' | 'missing_table' | 'unreadable' | 'invalid_limit' | 'invalid_request';
  details?: string;
  availableTables?: string[];

  constructor(
    code: 'missing_db' | 'missing_table' | 'unreadable' | 'invalid_limit' | 'invalid_request',
    message: string,
    details?: string,
    availableTables?: string[],
  ) {
    super(message);
    this.name = 'SessionDbInspectionError';
    this.code = code;
    this.details = details;
    this.availableTables = availableTables;
  }
}

function normalizeRoot(root: string): string {
  return root.trim().replace(/[\\/]+$/, '');
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function listDirectories(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function parseConfiguredRoots(): string[] {
  const configured = process.env.COPILOT_SESSION_STATE;
  if (!configured) return [];

  return configured
    .split(path.delimiter)
    .map(normalizeRoot)
    .filter((root) => root.length > 0);
}

function discoverWslSessionRoots(): string[] {
  if (process.platform !== 'win32') return [];

  const roots = new Set<string>();

  const registry = spawnSync('reg.exe', [
    'query',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss',
    '/s',
    '/v',
    'DistributionName',
  ], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1500,
  });

  if (registry.status !== 0 || !registry.stdout) return [];

  const distros = new Set<string>();
  for (const line of registry.stdout.split(/\r?\n/)) {
    const match = line.match(/DistributionName\s+REG_\w+\s+(.+)$/i);
    if (match) {
      const distro = match[1].trim();
      if (distro) distros.add(distro);
    }
  }

  for (const distro of distros) {
    const distroRoot = `\\\\wsl$\\${distro}`;

    const homeRoot = path.join(distroRoot, 'home');
    for (const user of listDirectories(homeRoot)) {
      const root = path.join(homeRoot, user, '.copilot', 'session-state');
      if (isDirectory(root)) {
        roots.add(root);
      }
    }

    const rootHome = path.join(distroRoot, 'root', '.copilot', 'session-state');
    if (isDirectory(rootHome)) {
      roots.add(rootHome);
    }
  }

  return [...roots];
}

function discoverSessionRoots(): string[] {
  const configuredRoots = parseConfiguredRoots();
  if (configuredRoots.length > 0) {
    return configuredRoots.filter(isDirectory);
  }

  const roots = [DEFAULT_SESSION_ROOT, ...discoverWslSessionRoots()];
  return [...new Set(roots.map(normalizeRoot))].filter(isDirectory);
}

export function getSessionRoots(): string[] {
  const configuredRootsKey = process.env.COPILOT_SESSION_STATE ?? null;
  const now = Date.now();

  if (
    sessionRootsCache &&
    sessionRootsCache.configuredRootsKey === configuredRootsKey &&
    now - sessionRootsCache.discoveredAt < ROOT_DISCOVERY_TTL_MS
  ) {
    return sessionRootsCache.roots.filter(isDirectory);
  }

  const roots = discoverSessionRoots();
  sessionRootsCache = { configuredRootsKey, roots, discoveredAt: now };
  return roots;
}

export function findSessionDir(sessionId: string): string | null {
  for (const root of getSessionRoots()) {
    const sessionDir = path.join(root, sessionId);
    if (isDirectory(sessionDir)) {
      return sessionDir;
    }
  }

  return null;
}

function parseEventsFile(filePath: string): RawEvent[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RawEvent);
  } catch {
    return [];
  }
}

function normalizeMessageText(content: string): string {
  return content.replace(/<[^>]+>/g, '').trim();
}

function titleFromContent(content?: string): string {
  if (!content) return 'Untitled session';
  const text = normalizeMessageText(content);
  // Allow longer titles for better sidebar display with line-clamp-2
  return text.length > 200 ? text.slice(0, 197) + '…' : text;
}

interface WorkspaceYaml {
  summary?: string;
  id?: string;
  cwd?: string;
  git_root?: string;
  repository?: string;
  host_type?: string;
  branch?: string;
  summary_count?: number;
  created_at?: string;
  updated_at?: string;
}

function readWorkspaceYaml(sessionDir: string): WorkspaceYaml | null {
  const workspaceFile = path.join(sessionDir, 'workspace.yaml');
  try {
    const content = fs.readFileSync(workspaceFile, 'utf8');
    return yaml.load(content) as WorkspaceYaml;
  } catch {
    return null;
  }
}

function extractTitle(messages: ParsedMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  return titleFromContent(firstUser?.content);
}



function readTodos(sessionDir: string): TodoItem[] | undefined {
  const dbPath = path.join(sessionDir, 'session.db');
  if (!fs.existsSync(dbPath)) return undefined;
  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT * FROM todos ORDER BY created_at ASC').all() as Array<{
      id: string; title: string; description: string; status: string;
      created_at: string; updated_at: string;
    }>;
    const deps = db.prepare('SELECT * FROM todo_deps').all() as Array<{ todo_id: string; depends_on: string }>;
    db.close();

    const depsMap: Record<string, string[]> = {};
    for (const d of deps) {
      (depsMap[d.todo_id] ??= []).push(d.depends_on);
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      dependsOn: depsMap[r.id] ?? [],
    }));
  } catch {
    return undefined;
  }
}

function formatTimestampFromStat(stat: fs.Stats): string {
  return new Date(stat.mtimeMs).toISOString();
}

function toSessionArtifactPath(sessionDir: string, itemPath: string): string {
  const relativePath = path.relative(sessionDir, itemPath);
  return relativePath.split(path.sep).join('/');
}

function isExcludedDirectory(name: string): boolean {
  return EXCLUDED_DIRECTORY_NAMES.includes(name);
}

function readSessionArtifactEntries(directoryPath: string, sessionDir: string): SessionArtifactEntry[] {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.isDirectory() || !isExcludedDirectory(entry.name))
    .map((entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      const stat = fs.statSync(fullPath);
      const artifactEntry: SessionArtifactEntry = {
        name: entry.name,
        path: toSessionArtifactPath(sessionDir, fullPath),
        kind: entry.isDirectory() ? 'directory' : 'file',
        sizeBytes: stat.size,
        modifiedAt: formatTimestampFromStat(stat),
      };

      if (entry.isDirectory()) {
        artifactEntry.children = readSessionArtifactEntries(fullPath, sessionDir);
      } else {
        const content = readTextArtifactContent(fullPath, stat);
        if (content !== undefined) {
          artifactEntry.content = content;
        }
      }

      return artifactEntry;
    })
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function readTextArtifactContent(filePath: string, stat: fs.Stats): string | undefined {
  if (stat.size > 2_000_000) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(filePath);
    return content.includes(0) ? undefined : content.toString('utf8');
  } catch {
    return undefined;
  }
}

function readSessionArtifactSection(
  sessionDir: string,
  section: SessionArtifactSectionName,
): SessionArtifactGroup {
  const sectionPath = path.join(sessionDir, section);

  if (!fs.existsSync(sectionPath)) {
    return {
      path: section,
      kind: 'directory',
      exists: false,
      status: 'missing',
      message: `The ${section}/ folder does not exist in this session directory.`,
    };
  }

  try {
    const stat = fs.statSync(sectionPath);
    if (!stat.isDirectory()) {
      return {
        path: section,
        kind: 'directory',
        exists: true,
        status: 'unreadable',
        message: `The ${section} path exists, but it is not a directory.`,
      };
    }

    return {
      path: section,
      kind: 'directory',
      exists: true,
      status: 'ok',
      entries: readSessionArtifactEntries(sectionPath, sessionDir),
    };
  } catch {
    return {
      path: section,
      kind: 'directory',
      exists: true,
      status: 'unreadable',
      message: `The ${section}/ folder exists, but the server could not read its contents.`,
    };
  }
}

function readPlanArtifact(sessionDir: string): SessionArtifactGroup {
  const planPath = path.join(sessionDir, 'plan.md');

  if (!fs.existsSync(planPath)) {
    return {
      path: 'plan.md',
      kind: 'file',
      exists: false,
      status: 'missing',
      message: 'No plan.md file exists for this session.',
    };
  }

  try {
    const stat = fs.statSync(planPath);
    return {
      path: 'plan.md',
      kind: 'file',
      exists: true,
      status: 'ok',
      sizeBytes: stat.size,
      modifiedAt: formatTimestampFromStat(stat),
      content: fs.readFileSync(planPath, 'utf8'),
    };
  } catch {
    return {
      path: 'plan.md',
      kind: 'file',
      exists: true,
      status: 'unreadable',
      message: 'plan.md exists, but the server could not read it.',
    };
  }
}

function readSessionArtifactsAtPath(sessionDir: string, sessionId: string): SessionArtifacts {
  return {
    sessionId,
    plan: readPlanArtifact(sessionDir),
    folders: SESSION_ARTIFACT_SECTIONS.map((section) => readSessionArtifactSection(sessionDir, section)),
  };
}

export function readSessionArtifacts(sessionId: string): SessionArtifacts | null {
  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) return null;
  return readSessionArtifactsAtPath(sessionDir, sessionId);
}

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getAvailableSessionDbTables(db: SqliteDatabase): Array<{ name: string; type: 'table' | 'view'; sql: string | null }> {
  return db
    .prepare(
      "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    )
    .all() as Array<{ name: string; type: 'table' | 'view'; sql: string | null }>;
}

function getSessionDbColumns(db: SqliteDatabase, tableName: string): SessionDbColumnInfo[] {
  const rows = db.prepare(`PRAGMA table_info(${quoteSqlIdentifier(tableName)})`).all() as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;

  return rows.map((column) => ({
    name: column.name,
    type: column.type,
    notNull: column.notnull === 1,
    defaultValue: column.dflt_value ?? null,
    isPrimaryKey: column.pk > 0,
    primaryKeyOrder: column.pk,
  }));
}

export function inspectSessionDb(sessionId: string, tableName = '', limit = 25): SessionDbInspection | null {
  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) {
    // Check if this is a VS Code session (no session.db)
    const vscodeDetail = parseVscodeSessionDir(sessionId);
    if (vscodeDetail) {
      throw new SessionDbInspectionError(
        'missing_db',
        'session.db not found for this session.',
        'VS Code sessions do not have a session.db file.',
      );
    }
    return null;
  }

  const dbPath = path.join(sessionDir, 'session.db');
  if (!fs.existsSync(dbPath)) {
    throw new SessionDbInspectionError(
      'missing_db',
      'session.db not found for this session.',
      'This session directory does not contain a session.db file yet.',
    );
  }

  const normalizedTableName = tableName.trim();

  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 25;
  const boundedLimit = Math.min(Math.max(normalizedLimit, 1), SESSION_DB_PREVIEW_LIMIT);

  let db: SqliteDatabase | undefined;

  try {
    db = new Database(dbPath, { readonly: true });
    const availableTables = getAvailableSessionDbTables(db);
    if (availableTables.length === 0) {
      return {
        sessionId,
        databasePath: dbPath,
        availableTables: [],
        table: {
          name: '',
          type: 'table',
          sql: null,
          columns: [],
          rowCount: 0,
          limit: boundedLimit,
          rows: [],
        },
      };
    }

    const tableMeta = normalizedTableName
      ? availableTables.find((table) => table.name === normalizedTableName)
      : availableTables[0];

    if (!tableMeta) {
      throw new SessionDbInspectionError(
        'missing_table',
        `Table "${normalizedTableName}" was not found in session.db.`,
        'Choose one of the tables listed in availableTables.',
        availableTables.map((table) => table.name),
      );
    }

    const selectedTableName = tableMeta.name;
    const columns = getSessionDbColumns(db, selectedTableName);
    const quotedTable = quoteSqlIdentifier(selectedTableName);
    const rowCountRow = db.prepare(`SELECT COUNT(*) AS count FROM ${quotedTable}`).get() as { count: number | bigint | null } | undefined;
    const rowCount = Number(rowCountRow?.count ?? 0);
    const rows = db.prepare(`SELECT * FROM ${quotedTable} LIMIT ?`).all(boundedLimit) as Array<Record<string, unknown>>;

    const table: SessionDbTablePreview = {
      name: selectedTableName,
      type: tableMeta.type,
      sql: tableMeta.sql,
      columns,
      rowCount,
      limit: boundedLimit,
      rows,
    };

    return {
      sessionId,
      databasePath: toSessionArtifactPath(sessionDir, dbPath),
      availableTables: availableTables.map((tableRow) => tableRow.name),
      table,
    };
  } catch (error) {
    if (error instanceof SessionDbInspectionError) {
      throw error;
    }

    throw new SessionDbInspectionError(
      'unreadable',
      'Unable to inspect session.db.',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    db?.close();
  }
}

function buildPreviewMessages(messages: ParsedMessage[]): MessagePreview[] {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const last2 = visible.slice(-2);
  return last2.map((m) => ({
    role: m.role as 'user' | 'assistant',
    snippet: normalizeMessageText(m.content).slice(0, 120),
    ...(m.toolRequests?.length ? { toolNames: m.toolRequests.map((t) => t.name) } : {}),
  }));
}

function getLockState(sessionDir: string): { isOpen: boolean; signature: string } {
  const lockFiles = fs
    .readdirSync(sessionDir)
    .filter((file) => file.startsWith('inuse.') && file.endsWith('.lock'))
    .sort();

  return {
    isOpen: lockFiles.length > 0,
    signature: lockFiles.length > 0 ? lockFiles.join('|') : 'closed',
  };
}

function hasLockFile(sessionDir: string): boolean {
  return getLockState(sessionDir).isOpen;
}

function getFileSignature(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

function appendPreviewMessage(previewMessages: MessagePreview[], message: MessagePreview): void {
  if (previewMessages.length === 2) {
    previewMessages.shift();
  }
  previewMessages.push(message);
}

function getParentToolCallId(event: RawEvent): string | undefined {
  const parentToolCallId = (event.data as Record<string, unknown>).parentToolCallId;
  return typeof parentToolCallId === 'string' ? parentToolCallId : undefined;
}

function getTurnId(event: RawEvent): string | undefined {
  const turnId = (event.data as Record<string, unknown>).turnId;
  return typeof turnId === 'string' ? turnId : undefined;
}

function getAssistantTurnKey(event: RawEvent): string {
  const turnId = getTurnId(event);
  if (turnId) {
    return `turn:${turnId}`;
  }

  return `thread:${getParentToolCallId(event) ?? '__root__'}`;
}

function parseTimestampMs(timestamp: string): number | null {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? null : value;
}

function mergeSessionContext(
  current?: SessionContextData,
  next?: SessionContextData,
): SessionContextData | undefined {
  if (!next) return current;
  return { ...current, ...next };
}

function toSessionEventError(event: RawEvent): SessionEventError | null {
  if (event.type !== 'session.error') return null;

  const data = event.data as Partial<SessionErrorData>;
  if (typeof data.errorType !== 'string' || typeof data.message !== 'string') {
    return null;
  }

  return {
    type: data.errorType,
    message: data.message,
    timestamp: event.timestamp,
    ...(typeof data.statusCode === 'number' ? { statusCode: data.statusCode } : {}),
  };
}

function findLatestSessionContext(
  events: RawEvent[],
  initialContext?: SessionContextData,
): SessionContextData | undefined {
  let context = initialContext;

  for (const event of events) {
    if (event.type !== 'session.resume') continue;
    const data = event.data as unknown as SessionResumeData;
    context = mergeSessionContext(context, data.context);
  }

  return context;
}

function findLatestResumeModel(events: RawEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== 'session.resume') continue;
    const data = event.data as unknown as SessionResumeData;
    if (data.selectedModel) {
      return data.selectedModel;
    }
  }

  return undefined;
}

function findLastSessionError(events: RawEvent[]): SessionEventError | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const error = toSessionEventError(events[index]);
    if (error) {
      return error;
    }
  }

  return null;
}

function getUsageEstimateFromAssistantTurns(events: RawEvent[], fallbackTimestamp: string): Pick<
  SessionUsageMetrics,
  'totalApiDurationEstimateMs' | 'totalPremiumRequestsEstimate'
> {
  // Live fallback only: this is a heuristic derived from observed assistant-turn timing
  // and completed turn count, not an exact premium-billing counter.
  const openTurns = new Map<string, number>();
  let totalApiDurationEstimateMs = 0;
  let totalPremiumRequestsEstimate = 0;

  for (const event of events) {
    const timestampMs = parseTimestampMs(event.timestamp);
    if (timestampMs === null) continue;

    if (event.type === 'assistant.turn_start') {
      const turnKey = getAssistantTurnKey(event);
      const existingStartedAt = openTurns.get(turnKey);

      if (existingStartedAt !== undefined) {
        totalApiDurationEstimateMs += Math.max(0, timestampMs - existingStartedAt);
      }

      openTurns.set(turnKey, timestampMs);
      continue;
    }

    if (event.type === 'assistant.turn_end') {
      const turnKey = getAssistantTurnKey(event);
      const startedAt = openTurns.get(turnKey);
      if (startedAt === undefined) continue;

      totalApiDurationEstimateMs += Math.max(0, timestampMs - startedAt);
      openTurns.delete(turnKey);
      totalPremiumRequestsEstimate += 1;
    }
  }

  const fallbackTimestampMs = parseTimestampMs(fallbackTimestamp);
  if (fallbackTimestampMs !== null) {
    for (const startedAt of openTurns.values()) {
      totalApiDurationEstimateMs += Math.max(0, fallbackTimestampMs - startedAt);
    }
  }

  return {
    totalApiDurationEstimateMs,
    totalPremiumRequestsEstimate,
  };
}

function buildSessionUsageMetrics(
  events: RawEvent[],
  fallbackTimestamp: string,
  shutdownData?: ShutdownData,
  shutdownTimestamp?: string,
): SessionUsageMetrics {
  const shutdownTimestampMs = shutdownTimestamp ? parseTimestampMs(shutdownTimestamp) : null;
  const estimateEvents =
    shutdownTimestampMs === null
      ? events
      : events.filter((event) => {
        const timestampMs = parseTimestampMs(event.timestamp);
        return timestampMs !== null && timestampMs > shutdownTimestampMs;
      });
  const { totalApiDurationEstimateMs, totalPremiumRequestsEstimate } = getUsageEstimateFromAssistantTurns(
    estimateEvents,
    fallbackTimestamp,
  );
  const hasShutdownApiDuration = typeof shutdownData?.totalApiDurationMs === 'number';
  const hasShutdownPremiumRequests = typeof shutdownData?.totalPremiumRequests === 'number';
  const hasEstimatedApiDelta = totalApiDurationEstimateMs > 0;
  const hasEstimatedPremiumDelta = totalPremiumRequestsEstimate > 0;

  return {
    totalApiDurationMs: hasShutdownApiDuration ? shutdownData.totalApiDurationMs : null,
    totalApiDurationEstimateMs: hasShutdownApiDuration
      ? shutdownData.totalApiDurationMs + totalApiDurationEstimateMs
      : totalApiDurationEstimateMs,
    totalApiDurationSource: hasShutdownApiDuration
      ? (hasEstimatedApiDelta ? 'shutdown_plus_assistant_turn_estimate' : 'shutdown')
      : 'assistant_turn_estimate',
    totalPremiumRequests: hasShutdownPremiumRequests ? shutdownData.totalPremiumRequests : null,
    totalPremiumRequestsEstimate: hasShutdownPremiumRequests
      ? shutdownData.totalPremiumRequests + totalPremiumRequestsEstimate
      : totalPremiumRequestsEstimate,
    totalPremiumRequestsSource: hasShutdownPremiumRequests
      ? (hasEstimatedPremiumDelta ? 'shutdown_plus_assistant_turn_estimate' : 'shutdown')
      : 'assistant_turn_estimate',
  };
}

function isRootThreadEvent(event: RawEvent): boolean {
  return getParentToolCallId(event) === undefined;
}

const CLI_CAPABILITIES: import('./sessionTypes.js').SessionCapabilities = {
  supportsInjection: true,
  supportsToolLifecycle: true,
  supportsPlanArtifacts: true,
};

function createStubSessionSummary(sessionId: string, sessionDir?: string, now = new Date().toISOString()): SessionSummary {
  const workspace = sessionDir ? readWorkspaceYaml(sessionDir) : null;
  const projectPath = workspace?.cwd ?? 'Unknown';
  const gitBranch = workspace?.branch ?? null;
  const title = workspace?.summary ?? 'New';
  return {
    id: sessionId,
    source: 'cli',
    title,
    summary: workspace?.summary ?? null,
    projectPath,
    gitBranch,
    startedAt: workspace?.created_at ?? now,
    lastActivityAt: workspace?.updated_at ?? now,
    durationMs: 0,
    isOpen: true,
    needsAttention: false,
    isWorking: false,
    isAborted: false,
    isTaskComplete: false,
    isIdle: true,
    messageCount: 0,
    totalApiDurationMs: null,
    totalApiDurationEstimateMs: 0,
    totalApiDurationSource: 'assistant_turn_estimate',
    totalPremiumRequests: null,
    totalPremiumRequestsEstimate: 0,
    totalPremiumRequestsSource: 'assistant_turn_estimate',
    currentMode: 'interactive',
    activeSubAgents: [],
    hasPlan: false,
    isPlanPending: false,
    previewMessages: [],
    capabilities: CLI_CAPABILITIES,
  };
}

function createStubSessionDetail(sessionId: string): SessionDetail {
  return {
    ...createStubSessionSummary(sessionId),
    messages: [],
    subAgentMessages: {},
  };
}

function reduceEventForSessionSummary(event: RawEvent): RawEvent | null {
  const parentToolCallId = getParentToolCallId(event);

  switch (event.type) {
    case 'user.message':
      return { ...event, data: parentToolCallId ? { parentToolCallId } : {} };
    case 'assistant.message': {
      const data = event.data as unknown as AssistantMessageData;
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          ...(data.toolRequests ? { toolRequests: data.toolRequests } : {}),
        },
      };
    }
    case 'tool.execution_start': {
      const data = event.data as { toolCallId?: string; toolName?: string; arguments?: Record<string, unknown> };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          ...(data.arguments ? { arguments: data.arguments } : {}),
        },
      };
    }
    case 'tool.execution_complete': {
      const data = event.data as { toolCallId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
        },
      };
    }
    case 'session.mode_changed': {
      const data = event.data as { newMode?: string };
      return { ...event, data: { newMode: data.newMode } };
    }
    case 'subagent.started': {
      const data = event.data as {
        toolCallId?: string;
        agentName?: string;
        agentDisplayName?: string;
        agentDescription?: string;
        sessionId?: string;
      };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
          agentName: data.agentName,
          agentDisplayName: data.agentDisplayName,
          ...(data.agentDescription ? { agentDescription: data.agentDescription } : {}),
          ...(data.sessionId ? { sessionId: data.sessionId } : {}),
        },
      };
    }
    case 'subagent.completed':
    case 'subagent.failed': {
      const data = event.data as { toolCallId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          toolCallId: data.toolCallId,
        },
      };
    }
    case 'system.notification': {
      const data = event.data as SystemNotificationData;
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          ...(data.content ? { content: data.content } : {}),
          ...(data.kind ? { kind: data.kind } : {}),
        },
      };
    }
    case 'assistant.turn_start':
    case 'assistant.turn_end': {
      const data = event.data as { turnId?: string };
      return {
        ...event,
        data: {
          ...(parentToolCallId ? { parentToolCallId } : {}),
          ...(data.turnId ? { turnId: data.turnId } : {}),
        },
      };
    }
    case 'session.task_complete':
    case 'abort':
      return { ...event, data: {} };
    default:
      return null;
  }
}

function scanSessionSummary(eventsFile: string): SessionSummaryScan | null {
  try {
    const reducerEvents: RawEvent[] = [];
    const previewMessages: MessagePreview[] = [];
    const content = fs.readFileSync(eventsFile, 'utf8');

    let startData: SessionStartData | undefined;
    let latestContext: SessionContextData | undefined;
    let startedAt: string | undefined;
    let shutdownData: ShutdownData | undefined;
    let lastShutdownAt: string | undefined;
    let lastModelChange: string | undefined;
    let lastResumeModel: string | undefined;
    let lastError: SessionEventError | null = null;
    let lastActivityAt: string | undefined;
    let firstUserContent: string | undefined;
    let messageCount = 0;
    let eventCount = 0;
    let lineStart = 0;

    for (let index = 0; index <= content.length; index += 1) {
      if (index !== content.length && content.charCodeAt(index) !== 10) continue;

      let line = content.slice(lineStart, index);
      lineStart = index + 1;
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      if (line.trim().length === 0) {
        continue;
      }

      const event = JSON.parse(line) as RawEvent;
      eventCount += 1;
      lastActivityAt = event.timestamp;

      if (event.type === 'session.start' && !startData) {
        startData = event.data as unknown as SessionStartData;
        latestContext = startData.context;
        startedAt = startData.startTime ?? event.timestamp;
        continue;
      }

      if (event.type === 'session.shutdown') {
        shutdownData = event.data as unknown as ShutdownData;
        lastShutdownAt = event.timestamp;
        continue;
      }

      if (event.type === 'session.model_change') {
        const data = event.data as { newModel?: string };
        lastModelChange = data.newModel ?? lastModelChange;
        continue;
      }

      if (event.type === 'session.resume') {
        const data = event.data as unknown as SessionResumeData;
        lastResumeModel = data.selectedModel ?? lastResumeModel;
        latestContext = mergeSessionContext(latestContext, data.context);
        continue;
      }

      if (event.type === 'session.error') {
        lastError = toSessionEventError(event) ?? lastError;
        continue;
      }

      if (event.type === 'user.message' && isRootThreadEvent(event)) {
        const data = event.data as unknown as UserMessageData;
        if (!firstUserContent) {
          firstUserContent = data.content;
        }
        messageCount += 1;
        appendPreviewMessage(previewMessages, {
          role: 'user',
          snippet: normalizeMessageText(data.content).slice(0, 120),
        });
      } else if (event.type === 'assistant.message' && isRootThreadEvent(event)) {
        const data = event.data as unknown as AssistantMessageData;
        appendPreviewMessage(previewMessages, {
          role: 'assistant',
          snippet: normalizeMessageText(data.content).slice(0, 120),
          ...(data.toolRequests?.length ? { toolNames: data.toolRequests.map((tool) => tool.name) } : {}),
        });
      }

      const reducedEvent = reduceEventForSessionSummary(event);
      if (reducedEvent) {
        reducerEvents.push(reducedEvent);
      }
    }

    return {
      reducerEvents,
      eventCount,
      startData,
      latestContext,
      startedAt,
      shutdownData,
      lastShutdownAt,
      lastModelChange,
      lastResumeModel,
      lastError,
      lastActivityAt,
      firstUserContent,
      messageCount,
      previewMessages,
    };
  } catch {
    return null;
  }
}

function parseSessionSummaryAtPath(sessionDir: string, sessionId: string): SessionSummary | null {
  const eventsFile = path.join(sessionDir, 'events.jsonl');
  const planFile = path.join(sessionDir, 'plan.md');
  const lockState = getLockState(sessionDir);
  const isOpen = lockState.isOpen;
  const signature = [
    getFileSignature(eventsFile),
    getFileSignature(planFile),
    lockState.signature,
  ].join('|');
  const cached = sessionSummaryCache.get(sessionDir);
  if (cached?.signature === signature) {
    return cached.summary;
  }

  const scan = fs.existsSync(eventsFile) ? scanSessionSummary(eventsFile) : null;

  if (!scan || scan.eventCount === 0 || !scan.startData || !scan.startedAt) {
    const summary = isOpen ? createStubSessionSummary(sessionId, sessionDir) : null;
    sessionSummaryCache.set(sessionDir, { signature, summary });
    return summary;
  }

  const currentMode = getCurrentMode(scan.reducerEvents);
  const sessionStatus = lastSessionStatus(scan.reducerEvents);
  const activeSubAgents = buildActiveSubAgents(scan.reducerEvents);
  const hasPlan = fs.existsSync(planFile);
  const lastActivityAt = scan.lastActivityAt ?? scan.startedAt;
  const sessionContext = scan.latestContext ?? scan.startData.context;
  const usageMetrics = buildSessionUsageMetrics(
    scan.reducerEvents,
    lastActivityAt,
    scan.shutdownData,
    scan.lastShutdownAt,
  );

  const workspace = readWorkspaceYaml(sessionDir);
  const sessionSummary = workspace?.summary ?? null;

  const summary: SessionSummary = {
    id: sessionId,
    source: 'cli',
    title: sessionSummary ?? titleFromContent(scan.firstUserContent),
    summary: sessionSummary,
    projectPath: sessionContext?.cwd || workspace?.cwd || 'Unknown',
    gitBranch: sessionContext?.branch || workspace?.branch || null,
    startedAt: scan.startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(scan.startedAt),
    isOpen,
    needsAttention: needsAttention(scan.reducerEvents, isOpen),
    isWorking: isOpen && (sessionStatus === 'working' || hasPendingWork(scan.reducerEvents)),
    isAborted: isOpen && sessionStatus === 'aborted',
    isTaskComplete: isOpen && sessionStatus === 'task_complete',
    isIdle: isOpen && sessionStatus === 'idle',
    messageCount: scan.messageCount,
    model: scan.lastModelChange ?? scan.lastResumeModel ?? scan.shutdownData?.currentModel,
    ...usageMetrics,
    currentMode,
    lastError: scan.lastError ?? null,
    activeSubAgents,
    hasPlan,
    isPlanPending: isOpen && hasPendingPlanApproval(scan.reducerEvents),
    previewMessages: scan.previewMessages,
    capabilities: CLI_CAPABILITIES,
  };

  sessionSummaryCache.set(sessionDir, { signature, summary });
  return summary;
}

function shouldIncludeSessionInList(summary: SessionSummary): boolean {
  return summary.isOpen || summary.messageCount > 0;
}

function parseSessionDirAtPath(sessionDir: string, sessionId: string): SessionDetail | null {
  const eventsFile = path.join(sessionDir, 'events.jsonl');

  const hasLockFilePresent = hasLockFile(sessionDir);
  // Lock file is the source of truth: present = process is running, even if a
  // prior run wrote a session.shutdown (e.g. a resumed session).
  const isOpen = hasLockFilePresent;

  const events = fs.existsSync(eventsFile) ? parseEventsFile(eventsFile) : [];

  const startEvent = events.find((e) => e.type === 'session.start');
  const shutdownEvent = [...events].reverse().find((e) => e.type === 'session.shutdown');

  // Brand-new session: lock file exists but events not yet written — show as
  // a placeholder so it appears immediately in the list.
  if (events.length === 0 || !startEvent) {
    return isOpen ? { ...createStubSessionSummary(sessionId, sessionDir), messages: [], subAgentMessages: {} } : null;
  }

  const startData = startEvent.data as unknown as SessionStartData;
  const startedAt = startData.startTime ?? startEvent.timestamp;
  const sessionContext = findLatestSessionContext(events, startData.context);

  const messages = buildMessages(events, isOpen);
  const lastActivityAt = events[events.length - 1]?.timestamp ?? startedAt;

  const shutdownData = shutdownEvent?.data as unknown as ShutdownData | undefined;
  const usageMetrics = buildSessionUsageMetrics(events, lastActivityAt, shutdownData, shutdownEvent?.timestamp);
  // Prefer the last model_change event (covers active sessions); fall back to shutdown metadata
  const lastModelChange = [...events].reverse().find((e) => e.type === 'session.model_change');
  const resumeModel = findLatestResumeModel(events);
  const lastError = findLastSessionError(events);
  const model =
    (lastModelChange?.data as unknown as { newModel?: string } | undefined)?.newModel ??
    resumeModel ??
    shutdownData?.currentModel;

  const activeSubAgents = buildActiveSubAgents(events);
  const subAgentMessages = buildSubAgentMessages(events, activeSubAgents, isOpen);

  const planFile = path.join(sessionDir, 'plan.md');
  const hasPlan = fs.existsSync(planFile);
  const isPlanPending = isOpen && hasPendingPlanApproval(events);
  const planContent = hasPlan ? fs.readFileSync(planFile, 'utf8') : undefined;

  const workspace = readWorkspaceYaml(sessionDir);
  const sessionSummary = workspace?.summary ?? null;

  const summary: SessionSummary = {
    id: sessionId,
    source: 'cli',
    title: sessionSummary ?? extractTitle(messages),
    summary: sessionSummary,
    projectPath: sessionContext?.cwd || workspace?.cwd || 'Unknown',
    gitBranch: sessionContext?.branch || workspace?.branch || null,
    startedAt,
    lastActivityAt,
    durationMs: Date.parse(lastActivityAt) - Date.parse(startedAt),
    isOpen,
    needsAttention: needsAttention(events, isOpen),
    isWorking: isOpen && (lastSessionStatus(events) === 'working' || hasPendingWork(events)),
    isAborted: isOpen && lastSessionStatus(events) === 'aborted',
    isTaskComplete: isOpen && lastSessionStatus(events) === 'task_complete',
    isIdle: isOpen && lastSessionStatus(events) === 'idle',
    messageCount: messages.filter((m) => m.role === 'user').length,
    model,
    ...usageMetrics,
    currentMode: getCurrentMode(events),
    lastError,
    activeSubAgents,
    hasPlan,
    isPlanPending,
    previewMessages: buildPreviewMessages(messages),
    capabilities: CLI_CAPABILITIES,
  };

  const todos = readTodos(sessionDir);

  return { ...summary, messages, subAgentMessages, planContent, todos };
}

export function parseSessionDir(sessionId: string): SessionDetail | null {
  const sessionDir = findSessionDir(sessionId);
  if (sessionDir) {
    return parseSessionDirAtPath(sessionDir, sessionId);
  }
  // Fallback: check VS Code sessions
  return parseVscodeSessionDir(sessionId);
}

/**
 * Convert a CatalogSession to SessionSummary.
 * For dynamic fields (needsAttention, isWorking, etc.), we rely on filesystem
 * since the catalog may be stale. If sessionDir is not found, returns basic summary.
 */
function convertCatalogSessionToSummary(catalogSession: CatalogSession): SessionSummary {
  const sessionDir = findSessionDir(catalogSession.id);
  const isOpen = sessionDir ? hasLockFile(sessionDir) : false;

  // If we have the session directory, get full summary from filesystem for accuracy
  if (sessionDir) {
    const fsSummary = parseSessionSummaryAtPath(sessionDir, catalogSession.id);
    if (fsSummary) {
      return fsSummary;
    }
  }

  // Fallback: build summary from catalog data with defaults for dynamic fields
  // Prefer workspace.yaml when catalog fields are empty
  const workspace = sessionDir ? readWorkspaceYaml(sessionDir) : null;
  const now = new Date().toISOString();
  return {
    id: catalogSession.id,
    source: 'cli',
    title: catalogSession.summary || workspace?.summary || 'Untitled session',
    summary: catalogSession.summary || workspace?.summary || null,
    projectPath: catalogSession.cwd || workspace?.cwd || 'Unknown',
    gitBranch: catalogSession.branch || workspace?.branch || null,
    startedAt: catalogSession.created_at || workspace?.created_at || now,
    lastActivityAt: catalogSession.updated_at || workspace?.updated_at || now,
    durationMs: 0,
    isOpen,
    needsAttention: false,
    isWorking: false,
    isAborted: false,
    isTaskComplete: false,
    isIdle: !isOpen,
    messageCount: 0,
    totalApiDurationMs: null,
    totalApiDurationEstimateMs: 0,
    totalApiDurationSource: 'assistant_turn_estimate',
    totalPremiumRequests: null,
    totalPremiumRequestsEstimate: 0,
    totalPremiumRequestsSource: 'assistant_turn_estimate',
    currentMode: 'interactive',
    activeSubAgents: [],
    hasPlan: false,
    isPlanPending: false,
    previewMessages: [],
    capabilities: CLI_CAPABILITIES,
  };
}

/**
 * List all sessions from the central catalog database.
 * Returns null if catalog is not available or feature flag is not enabled.
 */
export function listAllSessionsFromCatalog(): SessionSummary[] | null {
  if (process.env.COPILOT_USE_CENTRAL_CATALOG !== 'true') return null;
  if (!isCatalogAvailable()) return null;

  const catalogSessions = querySessionsFromCatalog();
  if (!catalogSessions) return null;

  return catalogSessions.map(convertCatalogSessionToSummary);
}

/**
 * List all sessions from filesystem (original implementation).
 */
function listAllSessionsFromFilesystem(): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  const seenSessionIds = new Set<string>();
  const seenSessionDirs = new Set<string>();

  for (const root of getSessionRoots()) {
    const entries = fs.readdirSync(root, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || seenSessionIds.has(entry.name)) continue;
      seenSessionIds.add(entry.name);

      const sessionDir = path.join(root, entry.name);
      seenSessionDirs.add(sessionDir);
      const summary = parseSessionSummaryAtPath(sessionDir, entry.name);
      if (summary && shouldIncludeSessionInList(summary)) {
        sessions.push(summary);
      }
    }
  }

  for (const cachedSessionDir of sessionSummaryCache.keys()) {
    if (!seenSessionDirs.has(cachedSessionDir)) {
      sessionSummaryCache.delete(cachedSessionDir);
    }
  }

  // Sort by last activity, newest first
  return sessions.sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
  );
}

/**
 * List all sessions with catalog-first approach.
 * If COPILOT_USE_CENTRAL_CATALOG is enabled and catalog is available, use it.
 * Otherwise fall back to filesystem scanning.
 * If COPILOT_CATALOG_VALIDATE is enabled, compare catalog with filesystem and log discrepancies.
 */
export function listAllSessions(): SessionSummary[] {
  // Collect CLI sessions
  let cliSessions: SessionSummary[];

  // Try catalog first if enabled
  if (process.env.COPILOT_USE_CENTRAL_CATALOG === 'true') {
    const catalogSessions = listAllSessionsFromCatalog();
    if (catalogSessions) {
      // Validate: if COPILOT_CATALOG_VALIDATE is true, compare with filesystem
      if (process.env.COPILOT_CATALOG_VALIDATE === 'true') {
        const filesystemSessions = listAllSessionsFromFilesystem();
        const discrepancies = detectDiscrepancies(
          catalogSessions.map((s) => ({ 
            id: s.id, 
            updated_at: s.lastActivityAt,
            cwd: s.projectPath,
            repository: null,
            branch: s.gitBranch,
            summary: s.summary,
            created_at: s.startedAt,
            host_type: null,
          }) as CatalogSession),
          filesystemSessions.map((s) => s.id)
        );
        if (discrepancies.length > 0) {
          console.warn('[Catalog] Discrepancies detected between catalog and filesystem:', discrepancies);
        }
      }
      cliSessions = catalogSessions;
    } else {
      cliSessions = listAllSessionsFromFilesystem();
    }
  } else {
    cliSessions = listAllSessionsFromFilesystem();
  }

  // Collect VS Code sessions if enabled
  const vscodeSessions = listAllVscodeSessions();

  // Merge with dedupe: CLI takes precedence over VS Code for same sessionId
  const merged = new Map<string, SessionSummary>();
  for (const s of vscodeSessions) {
    merged.set(s.id, s);
  }
  for (const s of cliSessions) {
    if (merged.has(s.id)) {
      console.warn(`[SessionMerge] Session ID collision across sources: ${s.id}. CLI takes precedence.`);
    }
    merged.set(s.id, s);
  }

  return Array.from(merged.values()).sort(
    (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
  );
}

/**
 * Convert catalog search results to the ResearchFileMatch format for API compatibility.
 */
function convertCatalogSearchResults(catalogResults: import('./utils/catalogSearch.js').SearchResult[]): import('./sessionTypes.js').SearchResult[] {
  return catalogResults.map((result) => ({
    sessionId: result.sessionId,
    sessionName: 'Unknown', // Catalog search doesn't provide session name directly
    filePath: `${result.sourceType}:${result.sourceId}`,
    fileName: result.sourceType,
    snippet: result.content.slice(0, 150),
    lastModified: new Date().toISOString(),
  }));
}

/**
 * Search across sessions using the central catalog's FTS5 search_index.
 * Falls back to filesystem-based research artifact search if catalog is not available.
 */
export async function searchSessions(query: string): Promise<import('./sessionTypes.js').SearchResult[]> {
  // Try catalog search first if available
  if (isCatalogAvailable()) {
    try {
      const catalogResults = searchAcrossSessions(query);
      if (catalogResults.length > 0) {
        return convertCatalogSearchResults(catalogResults);
      }
    } catch (error) {
      console.warn('[Catalog] Search failed, falling back to filesystem:', error);
    }
  }

  // Fall back to filesystem-based research artifact search
  return searchResearchArtifacts(query);
}

interface ResearchFileMatch {
  sessionId: string;
  sessionName: string;
  filePath: string;
  fileName: string;
  snippet: string;
  lastModified: string;
}

const TEXT_FILE_EXTENSIONS = ['.md', '.txt'];
const MAX_RESULTS = 50;
const MAX_FILE_SIZE = 50 * 1024; // 50 KB
const SNIPPET_LENGTH = 150;
const CONCURRENCY_LIMIT = 10;

function isTextFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return TEXT_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

function extractSnippet(content: string, query: string): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    // Return first line or first SNIPPET_LENGTH chars
    const firstLine = content.split('\n')[0] ?? '';
    return firstLine.length > SNIPPET_LENGTH ? firstLine.slice(0, SNIPPET_LENGTH) + '…' : firstLine;
  }

  // Extract snippet around the match
  const start = Math.max(0, index - SNIPPET_LENGTH / 2);
  const end = Math.min(content.length, index + query.length + SNIPPET_LENGTH / 2);
  let snippet = content.slice(start, end);

  if (start > 0) snippet = '…' + snippet;
  if (end < content.length) snippet = snippet + '…';

  return snippet.replace(/\s+/g, ' ').trim();
}

async function searchSessionResearch(
  sessionId: string,
  sessionDir: string,
  query: string
): Promise<ResearchFileMatch[]> {
  const researchDir = path.join(sessionDir, 'research');

  // Check if research directory exists
  try {
    const stat = await fs.promises.stat(researchDir);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  const matches: ResearchFileMatch[] = [];
  const workspace = readWorkspaceYaml(sessionDir);
  const sessionName = workspace?.summary ?? 'Untitled session';

  let entries: string[];
  try {
    entries = await fs.promises.readdir(researchDir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const fullPath = path.join(researchDir, entry);
    const relativePath = `research/${entry}`;

    // Validate path is within allowed artifacts
    if (!isPathWithinAllowedArtifacts(relativePath)) continue;

    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) continue;

      const fileName = entry;
      const lowerFileName = fileName.toLowerCase();
      const lowerQuery = query.toLowerCase();

      // Check filename match
      const fileNameMatch = lowerFileName.includes(lowerQuery);
      let contentMatch = false;
      let snippet = '';

      // For text files, also check content
      if (isTextFile(fileName) && stat.size <= MAX_FILE_SIZE) {
        try {
          const content = await fs.promises.readFile(fullPath, 'utf8');
          if (content.toLowerCase().includes(lowerQuery)) {
            contentMatch = true;
            snippet = extractSnippet(content, query);
          } else if (fileNameMatch) {
            // Filename matches but content doesn't - extract first line as snippet
            snippet = extractSnippet(content, '');
          }
        } catch {
          // Ignore read errors
        }
      } else if (fileNameMatch) {
        snippet = fileName;
      }

      if (fileNameMatch || contentMatch) {
        matches.push({
          sessionId,
          sessionName,
          filePath: relativePath,
          fileName,
          snippet: snippet || fileName,
          lastModified: formatTimestampFromStat(stat),
        });
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return matches;
}

async function withConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<ResearchFileMatch[]>
): Promise<ResearchFileMatch[]> {
  const results: ResearchFileMatch[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults.flat());
  }

  return results;
}

// ============================================================================

export interface InjectMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Inject a message into a session by appending to events.jsonl.
 * This allows human intervention in stuck sessions.
 */
export function injectMessage(
  sessionId: string,
  content: string,
  role: 'user' | 'assistant' = 'user'
): InjectMessageResult {
  const sessionDir = findSessionDir(sessionId);
  if (!sessionDir) {
    // Check if this is a VS Code session
    const vscodeDetail = parseVscodeSessionDir(sessionId);
    if (vscodeDetail) {
      return { success: false, error: 'Message injection is only supported for CLI sessions' };
    }
    return { success: false, error: 'Session not found' };
  }

  // Injection is only supported for CLI sessions
  const detail = parseSessionDirAtPath(sessionDir, sessionId);
  if (detail && detail.source !== 'cli') {
    return { success: false, error: 'Message injection is only supported for CLI sessions' };
  }

  const eventsFile = path.join(sessionDir, 'events.jsonl');

  // Generate a unique message ID
  const messageId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const timestamp = new Date().toISOString();

  let event: RawEvent;
  if (role === 'user') {
    event = {
      type: 'user.message',
      data: {
        content,
        source: 'manual',
        interactionId: messageId,
      },
      id: messageId,
      timestamp,
      parentId: null,
    };
  } else {
    event = {
      type: 'assistant.message',
      data: {
        messageId,
        content,
        interactionId: messageId,
      },
      id: messageId,
      timestamp,
      parentId: null,
    };
  }

  try {
    // Append the event to events.jsonl
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(eventsFile, line, 'utf8');
    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function searchResearchArtifacts(query: string): Promise<ResearchFileMatch[]> {
  const roots = getSessionRoots();
  const sessionDirs: Array<{ sessionId: string; sessionDir: string }> = [];

  // Collect all session directories
  for (const root of roots) {
    try {
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          sessionDirs.push({
            sessionId: entry.name,
            sessionDir: path.join(root, entry.name),
          });
        }
      }
    } catch {
      // Skip roots that can't be read
      continue;
    }
  }

  // Search each session's research directory with concurrency limit
  const allMatches = await withConcurrencyLimit(
    sessionDirs,
    CONCURRENCY_LIMIT,
    ({ sessionId, sessionDir }) => searchSessionResearch(sessionId, sessionDir, query)
  );

  // Sort by lastModified descending and cap results
  return allMatches
    .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified))
    .slice(0, MAX_RESULTS);
}
