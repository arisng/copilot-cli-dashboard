import { Router } from 'express';
import {
  inspectSessionDb,
  listAllSessions,
  parseSessionDir,
  readSessionArtifacts,
  readSessionArtifactFile,
  searchResearchArtifacts,
  SessionDbInspectionError,
  injectMessage,
} from './sessionReader.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

router.get('/config', (_req, res) => {
  res.json({
    vscodeSessionsEnabled: process.env.COPILOT_VSCODE_SESSIONS === 'true',
  });
});

router.get('/sessions', (_req, res) => {
  const sessions = listAllSessions();
  res.json({ sessions });
});

router.get('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const detail = parseSessionDir(sessionId);
  if (!detail) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(detail);
});

router.get('/sessions/:sessionId/artifacts', (req, res) => {
  const { sessionId } = req.params;
  const artifacts = readSessionArtifacts(sessionId);

  if (!artifacts) {
    res.status(404).json({
      error: 'Session not found',
      details: `No session directory was found for "${sessionId}".`,
    });
    return;
  }

  res.json(artifacts);
});

router.get('/sessions/:sessionId/artifacts/file', (req, res) => {
  const { sessionId } = req.params;
  const filePath = readStringQueryParam(req.query.path);

  if (!filePath) {
    res.status(400).json({
      error: 'Missing path parameter',
      details: 'The "path" query parameter is required.',
    });
    return;
  }

  try {
    const result = readSessionArtifactFile(sessionId, filePath);

    if (!result) {
      res.status(404).json({
        error: 'File not found',
        details: `The file "${filePath}" was not found in session "${sessionId}".`,
      });
      return;
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.sizeBytes);
    res.send(result.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Access denied';
    res.status(403).json({
      error: 'Access denied',
      details: message,
    });
  }
});

router.get('/sessions/:sessionId/session-db', (req, res) => {
  const { sessionId } = req.params;
  const table = readStringQueryParam(req.query.table);

  const limitValue = readPreviewLimit(req.query.limit);
  if (limitValue === null) {
    res.status(400).json({
      error: 'Invalid limit parameter',
      details: 'The limit query parameter must be an integer.',
    });
    return;
  }

  try {
    const inspection = inspectSessionDb(sessionId, table ?? '', limitValue);
    if (!inspection) {
      res.status(404).json({
        error: 'Session not found',
        details: `No session directory was found for "${sessionId}".`,
      });
      return;
    }

    res.json(inspection);
  } catch (error) {
    if (error instanceof SessionDbInspectionError) {
      const status = error.code === 'missing_db' || error.code === 'missing_table' ? 404 : error.code === 'invalid_request' ? 400 : 500;
      res.status(status).json({
        error: error.message,
        details: error.details,
        ...(error.availableTables ? { availableTables: error.availableTables } : {}),
      });
      return;
    }

    res.status(500).json({
      error: 'Unable to inspect session.db',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});


/**
 * POST /api/sessions/:sessionId/message
 * Inject a message into a session (for stuck sessions).
 * Appends a user.message event to events.jsonl.
 */
router.post('/sessions/:sessionId/message', (req, res) => {
  const { sessionId } = req.params;
  const { content, role = 'user' } = req.body as { content?: string; role?: 'user' | 'assistant' };

  // Validate content
  if (content === undefined || content === null) {
    res.status(400).json({
      success: false,
      error: 'Missing content',
      details: 'The "content" field is required in the request body.',
    });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Invalid content',
      details: 'The "content" field must be a string.',
    });
    return;
  }

  if (content.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Empty content',
      details: 'The "content" field cannot be empty.',
    });
    return;
  }

  // Validate role
  if (role !== 'user' && role !== 'assistant') {
    res.status(400).json({
      success: false,
      error: 'Invalid role',
      details: 'The "role" field must be either "user" or "assistant".',
    });
    return;
  }

  const result = injectMessage(sessionId, content, role);

  if (!result.success) {
    if (result.error?.includes('Session not found')) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }
    if (result.error?.includes('only supported for CLI sessions')) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    res.status(500).json({ success: false, error: result.error });
    return;
  }

  res.json({
    success: true,
    messageId: result.messageId,
    sessionId,
    role,
  });
});

function readStringQueryParam(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPreviewLimit(value: unknown): number | null {
  if (value === undefined) return 25;
  if (typeof value !== 'string') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;

  return Math.min(Math.max(parsed, 1), 100);
}

router.get('/search', async (req, res) => {
  const query = readStringQueryParam(req.query.q);
  const type = readStringQueryParam(req.query.type) ?? 'research';

  if (type !== 'research') {
    res.status(400).json({
      error: 'Invalid search type',
      details: `Search type "${type}" is not supported. Only "research" is supported in the pilot.`,
    });
    return;
  }

  try {
    const results = await searchResearchArtifacts(query ?? '');
    res.json({ results });
  } catch (error) {
    res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
