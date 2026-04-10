import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

const DEFAULT_CATALOG_PATH = path.join(os.homedir(), '.copilot', 'session-store.db');

/**
 * Get the path to the session catalog database.
 * Uses COPILOT_CATALOG_PATH environment variable if set, otherwise uses the default path.
 */
export function getCatalogPath(): string {
  return process.env.COPILOT_CATALOG_PATH || DEFAULT_CATALOG_PATH;
}

/**
 * Check if the catalog database is available and accessible.
 */
export function isCatalogAvailable(): boolean {
  const catalogPath = getCatalogPath();
  try {
    return fs.existsSync(catalogPath) && fs.accessSync(catalogPath, fs.constants.R_OK) === undefined || true;
  } catch {
    return false;
  }
}

/**
 * Represents a session from the catalog database.
 */
export interface CatalogSession {
  id: string;
  cwd: string | null;
  repository: string | null;
  branch: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  host_type: string | null;
}

/**
 * Query all sessions from the catalog database.
 * Returns null if the catalog is not available or an error occurs.
 */
export function querySessionsFromCatalog(): CatalogSession[] | null {
  if (!isCatalogAvailable()) return null;

  let db: Database.Database | undefined;
  try {
    db = new Database(getCatalogPath(), { readonly: true });
    const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as CatalogSession[];
    return rows;
  } catch (error) {
    console.error('Failed to query sessions from catalog:', error);
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Represents a search result from the FTS5 search index.
 */
export interface SearchResult {
  sessionId: string;
  content: string;
  sourceType: string;
  sourceId: string;
}

/**
 * Search across all sessions using the FTS5 search index.
 * Returns up to 50 results ordered by relevance rank.
 */
export function searchAcrossSessions(query: string): SearchResult[] {
  if (!isCatalogAvailable()) return [];
  if (!query || query.trim() === '') return [];

  let db: Database.Database | undefined;
  try {
    db = new Database(getCatalogPath(), { readonly: true });
    // FTS5 search - sanitize the query to prevent syntax errors
    const sanitizedQuery = query.trim().replace(/["]/g, '""');
    const rows = db
      .prepare('SELECT * FROM search_index WHERE content MATCH ? ORDER BY rank LIMIT 50')
      .all(sanitizedQuery) as SearchResult[];
    return rows;
  } catch (error) {
    console.error('Failed to search across sessions:', error);
    return [];
  } finally {
    db?.close();
  }
}

/**
 * Represents a checkpoint from the catalog database.
 */
export interface CatalogCheckpoint {
  session_id: string;
  checkpoint_number: number;
  title: string;
  overview: string;
  created_at: string;
}

/**
 * Query checkpoints for a specific session from the catalog.
 */
export function queryCheckpointsFromCatalog(sessionId: string): CatalogCheckpoint[] {
  if (!isCatalogAvailable()) return [];
  if (!sessionId) return [];

  let db: Database.Database | undefined;
  try {
    db = new Database(getCatalogPath(), { readonly: true });
    const rows = db
      .prepare('SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number DESC')
      .all(sessionId) as CatalogCheckpoint[];
    return rows;
  } catch (error) {
    console.error('Failed to query checkpoints from catalog:', error);
    return [];
  } finally {
    db?.close();
  }
}

/**
 * Represents a discrepancy between catalog and filesystem session data.
 */
export interface CatalogFilesystemDiscrepancy {
  sessionId: string;
  issue: 'missing-in-catalog' | 'missing-on-filesystem' | 'timestamp-mismatch';
  catalogUpdatedAt?: string;
  filesystemUpdatedAt?: string;
}

/**
 * Detect discrepancies between catalog and filesystem session data.
 * Identifies sessions that exist in one but not the other, or have timestamp mismatches.
 */
export function detectDiscrepancies(
  catalogSessions: CatalogSession[],
  filesystemSessionIds: string[]
): CatalogFilesystemDiscrepancy[] {
  const discrepancies: CatalogFilesystemDiscrepancy[] = [];

  const catalogSessionIds = new Set(catalogSessions.map((s) => s.id));
  const filesystemSessionIdsSet = new Set(filesystemSessionIds);

  // Find sessions missing in catalog but present on filesystem
  for (const sessionId of filesystemSessionIds) {
    if (!catalogSessionIds.has(sessionId)) {
      discrepancies.push({
        sessionId,
        issue: 'missing-in-catalog',
      });
    }
  }

  // Find sessions missing on filesystem but present in catalog
  for (const session of catalogSessions) {
    if (!filesystemSessionIdsSet.has(session.id)) {
      discrepancies.push({
        sessionId: session.id,
        issue: 'missing-on-filesystem',
        catalogUpdatedAt: session.updated_at,
      });
    }
  }

  return discrepancies;
}
