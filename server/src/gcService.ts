import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { calculateRetention, SessionRetentionInfo, getSessionDirectories } from './utils/retention.js';
import { getSessionRoots } from './sessionReader.js';

export interface GCOptions {
  dryRun?: boolean;
  archiveBeforeDelete?: boolean;
  archivePath?: string;
}

export interface GCResult {
  scanned: number;
  archived: number;
  deleted: number;
  bytesReclaimed: number;
  errors: string[];
  details: SessionRetentionInfo[];
}

interface ArchiveManifest {
  archivedAt: string;
  sessions: Array<{
    sessionId: string;
    sessionDir: string;
    state: string;
    lastActivityAt: string;
  }>;
}

export class GarbageCollectionService {
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the garbage collection service with periodic runs.
   * @param intervalHours - Hours between GC runs (default: 24)
   */
  start(intervalHours = 24): void {
    if (this.intervalId) return;

    // Run immediately on start
    this.runGC().catch((err) => {
      console.error('[GC] Initial run failed:', err);
    });

    // Schedule periodic runs
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runGC().catch((err) => {
        console.error('[GC] Scheduled run failed:', err);
      });
    }, intervalMs);

    console.log(`[GC] Service started with ${intervalHours}h interval`);
  }

  /**
   * Stop the garbage collection service.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[GC] Service stopped');
    }
  }

  /**
   * Run garbage collection once.
   */
  async runGC(options: GCOptions = {}): Promise<GCResult> {
    const result: GCResult = {
      scanned: 0,
      archived: 0,
      deleted: 0,
      bytesReclaimed: 0,
      errors: [],
      details: [],
    };

    console.log('[GC] Starting garbage collection...');
    const startTime = Date.now();

    try {
      const roots = getSessionRoots();

      for (const root of roots) {
        await this.processRoot(root, result, options);
      }

      // Clean up orphaned checkpoint files across all roots
      await this.cleanupOrphanedCheckpoints(roots, result, options);

      // Compress old events.jsonl files
      await this.compressOldEventLogs(roots, result, options);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`GC run failed: ${errorMsg}`);
      console.error('[GC] Run failed:', err);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[GC] Completed in ${duration}ms: ${result.scanned} scanned, ${result.archived} archived, ${result.deleted} deleted, ${result.bytesReclaimed} bytes reclaimed`
    );

    return result;
  }

  /**
   * Process all sessions in a root directory.
   */
  private async processRoot(
    rootPath: string,
    result: GCResult,
    options: GCOptions
  ): Promise<void> {
    const sessions = getSessionDirectories(rootPath);

    for (const { sessionId, sessionDir } of sessions) {
      try {
        const retentionInfo = calculateRetention(sessionDir, sessionId);
        result.scanned++;
        result.details.push(retentionInfo);

        if (retentionInfo.shouldDelete) {
          if (options.dryRun) {
            console.log(`[GC] Would delete: ${sessionId} (${retentionInfo.state}, ${retentionInfo.retentionDays} days)`);
            continue;
          }

          // Archive before delete if enabled
          if (options.archiveBeforeDelete && options.archivePath) {
            try {
              await this.archiveSession(sessionDir, options.archivePath);
              result.archived++;
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              result.errors.push(`Failed to archive ${sessionId}: ${errorMsg}`);
              // Continue to delete even if archive fails
            }
          }

          // Delete the session directory
          const bytesBefore = await this.calculateDirectorySize(sessionDir);
          await this.deleteSessionDirectory(sessionDir);
          result.deleted++;
          result.bytesReclaimed += bytesBefore;

          console.log(`[GC] Deleted: ${sessionId} (${retentionInfo.state}, ${retentionInfo.retentionDays} days)`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to process ${sessionId}: ${errorMsg}`);
        console.error(`[GC] Error processing ${sessionId}:`, err);
      }
    }
  }

  /**
   * Archive a session directory before deletion.
   */
  private async archiveSession(sessionDir: string, archivePath: string): Promise<void> {
    const sessionId = path.basename(sessionDir);
    const archiveDir = path.join(archivePath, 'sessions');

    // Ensure archive directory exists
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Copy session to archive
    const destDir = path.join(archiveDir, sessionId);
    await this.copyDirectory(sessionDir, destDir);

    // Update manifest
    const manifestPath = path.join(archivePath, 'manifest.json');
    let manifest: ArchiveManifest = { archivedAt: new Date().toISOString(), sessions: [] };

    try {
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf8');
        manifest = JSON.parse(content) as ArchiveManifest;
      }
    } catch {
      // Start fresh if manifest is corrupted
    }

    manifest.sessions.push({
      sessionId,
      sessionDir: destDir,
      state: 'archived',
      lastActivityAt: new Date().toISOString(),
    });

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Copy a directory recursively.
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Delete a session directory recursively.
   */
  private async deleteSessionDirectory(sessionDir: string): Promise<void> {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  /**
   * Calculate total size of a directory.
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else {
          const stat = fs.statSync(fullPath);
          totalSize += stat.size;
        }
      }
    } catch {
      // Ignore errors and return what we could calculate
    }

    return totalSize;
  }

  /**
   * Clean up orphaned checkpoint files that don't belong to any session.
   */
  private async cleanupOrphanedCheckpoints(
    roots: string[],
    result: GCResult,
    options: GCOptions
  ): Promise<void> {
    for (const root of roots) {
      try {
        const checkpointDir = path.join(root, '.checkpoints');
        if (!fs.existsSync(checkpointDir)) continue;

        const validSessionIds = new Set(getSessionDirectories(root).map((s) => s.sessionId));
        const checkpointEntries = fs.readdirSync(checkpointDir, { withFileTypes: true });

        for (const entry of checkpointEntries) {
          if (!entry.isDirectory()) continue;

          // Check if this checkpoint belongs to a valid session
          const sessionId = entry.name;
          if (!validSessionIds.has(sessionId)) {
            const orphanPath = path.join(checkpointDir, entry.name);
            const size = await this.calculateDirectorySize(orphanPath);

            if (options.dryRun) {
              console.log(`[GC] Would delete orphaned checkpoint: ${sessionId}`);
              continue;
            }

            fs.rmSync(orphanPath, { recursive: true, force: true });
            result.bytesReclaimed += size;
            console.log(`[GC] Deleted orphaned checkpoint: ${sessionId}`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to cleanup checkpoints in ${root}: ${errorMsg}`);
      }
    }
  }

  /**
   * Compress old events.jsonl files to save space.
   */
  private async compressOldEventLogs(
    roots: string[],
    result: GCResult,
    options: GCOptions
  ): Promise<void> {
    const COMPRESSION_AGE_DAYS = 7;
    const compressionThresholdMs = COMPRESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const root of roots) {
      try {
        const sessions = getSessionDirectories(root);

        for (const { sessionDir } of sessions) {
          const eventsPath = path.join(sessionDir, 'events.jsonl');
          const compressedPath = `${eventsPath}.gz`;

          // Skip if already compressed or doesn't exist
          if (!fs.existsSync(eventsPath) || fs.existsSync(compressedPath)) continue;

          // Check if file is old enough to compress
          const stat = fs.statSync(eventsPath);
          const ageMs = now - stat.mtimeMs;

          if (ageMs < compressionThresholdMs) continue;

          if (options.dryRun) {
            console.log(`[GC] Would compress: ${eventsPath}`);
            continue;
          }

          try {
            await pipeline(
              createReadStream(eventsPath),
              createGzip(),
              createWriteStream(compressedPath)
            );

            // Remove original after successful compression
            fs.unlinkSync(eventsPath);

            const newStat = fs.statSync(compressedPath);
            const saved = stat.size - newStat.size;
            result.bytesReclaimed += saved;

            console.log(`[GC] Compressed: ${eventsPath} (saved ${saved} bytes)`);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to compress ${eventsPath}: ${errorMsg}`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to compress events in ${root}: ${errorMsg}`);
      }
    }
  }

  /**
   * Check if the service is currently running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

// Singleton instance
export const gcService = new GarbageCollectionService();
