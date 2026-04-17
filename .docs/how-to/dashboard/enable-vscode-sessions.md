---
title: Enable VS Code Session Ingestion
description: How to show Copilot VS Code sessions in the dashboard.
---

# Enable VS Code Session Ingestion

## Server-side

Set the environment variable before starting the server:

```bash
# Windows PowerShell
$env:COPILOT_VSCODE_SESSIONS='true'
npm start

# Or cross-platform
COPILOT_VSCODE_SESSIONS=true npm start
```

When enabled, the server scans `%APPDATA%/Code/User/workspaceStorage/` (and `Code - Insiders`) for `GitHub.copilot-chat/transcripts/*.jsonl` files.

## Client-side

1. Open the dashboard.
2. In the filter bar, toggle **Show VS Code**.
3. The preference is saved in `localStorage` and persists across reloads.

If the server feature flag is disabled, the toggle is hidden automatically.

## Verification

- `GET /api/config` returns `{ vscodeSessionsEnabled: true }` when the server flag is on.
- `GET /api/sessions` includes sessions with `source: 'vscode'`.
- VS Code sessions show `capabilities.supportsInjection: false` and `supportsPlanArtifacts: false`.

## Disabling

Unset or set the environment variable to `false`:

```bash
$env:COPILOT_VSCODE_SESSIONS='false'
```

When disabled, the server skips VS Code discovery entirely and the client toggle disappears.
