---
description: API reference for the global search endpoint.
---

# Search API Reference

## Endpoint

```
GET /api/search
```

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | `""` | Search query text. Matches file names and content (for `.md` and `.txt` files). Empty string returns recent files. |
| `type` | string | Yes* | — | Search scope type. Only `"research"` is supported in the pilot. |

\* Required but defaults to research in current implementation.

## Response

### Success (200 OK)

```json
{
  "results": [
    {
      "sessionId": "uuid-string",
      "sessionName": "Session summary or title",
      "filePath": "research/filename.md",
      "fileName": "filename.md",
      "snippet": "Content excerpt showing match context...",
      "lastModified": "2026-04-08T14:30:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | UUID of the session containing the file |
| `sessionName` | string | Human-readable session name from `workspace.yaml` |
| `filePath` | string | Relative path from session root (e.g., `research/file.md`) |
| `fileName` | string | File name only |
| `snippet` | string | Content excerpt (first line, or context around match) |
| `lastModified` | string | ISO 8601 timestamp of last file modification |

### Error (400 Bad Request)

Returned when an unsupported `type` parameter is provided:

```json
{
  "error": "Invalid search type",
  "details": "Search type \"files\" is not supported. Only \"research\" is supported in the pilot."
}
```

### Error (500 Internal Server Error)

Returned when file system errors occur during search:

```json
{
  "error": "Search failed",
  "details": "Error message describing the failure"
}
```

## Limits and Performance

- **Max results**: 50 files
- **File size limit**: 50 KB per file (larger files are skipped for content search)
- **Concurrency**: Session directories are scanned with a concurrency limit of 10
- **Target response time**: < 200ms for ≤ 20 sessions

## Path Security

All file paths are validated against `ALLOWED_ARTIFACT_PREFIXES` before reading. Paths containing `..` or outside the session directory are rejected.

## Example Usage

### curl

```bash
curl "http://localhost:3001/api/search?q=memory&type=research"
```

### TypeScript Client

```typescript
import { searchResearch } from './api/client';

const results = await searchResearch('memory');
for (const result of results) {
  console.log(`${result.sessionName}: ${result.fileName}`);
}
```
