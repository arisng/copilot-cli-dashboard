---
title: "Feature Plan: Ingest Copilot VS Code sessions in dashboard"
type: "Feature"
status: "In Progress"
author: "GitHub Copilot"
created: "2026-04-17"
updated: "2026-04-18"
priority: "High"
description: "Baseline implementation to add Copilot VS Code session ingestion alongside existing Copilot CLI sessions. Scope is intentionally narrowed to transcript-only ingestion with CLI logic kept intact."
---

# Feature Plan: Ingest Copilot VS Code sessions in dashboard

## Summary

This issue tracks the **baseline** implementation of VS Code session ingestion. The dashboard currently reads only CLI sessions from `~/.copilot/session-state/`. VS Code sessions are stored in `%APPDATA%/Code/User/workspaceStorage/` and use a compatible event envelope, enabling transcript-first ingestion with minimal parsing changes.

**Scope is intentionally narrow** to avoid regressions in the existing CLI path. chatSessions fallback, provider abstraction extraction, and client UI source badges are deferred to follow-up issues.

## Multi-pass Findings (Ground Truth)

1. VS Code storage sample root contains:
	- `chatSessions/*.jsonl` (state patch log with `kind: 0|1|2`)
	- `GitHub.copilot-chat/transcripts/*.jsonl` (event stream with CLI-like envelope)
	- `GitHub.copilot-chat/debug-logs/<id>/main.jsonl` (diagnostic traces, not primary timeline)
2. Transcript event types observed in sample:
	- `session.start`
	- `user.message`
	- `assistant.message`
	- `assistant.turn_start`
	- `assistant.turn_end`
	- `tool.execution_start`
	- `tool.execution_complete`
3. Coverage is uneven in sample:
	- `chatSessions`: 121
	- `transcripts`: 20
	- `chatSessions` with transcript: 19
	- `chatSessions` without transcript: 102
4. Key compatibility finding:
	- Transcripts use the **exact same** `{ type, data, id, timestamp, parentId }` envelope as CLI `events.jsonl`
	- `parseEventsFile()`, `buildMessages()`, `buildActiveSubAgents()`, and `needsAttention.ts` can process transcript events without modification
	- `session.start` in transcripts **lacks** `context` (no cwd/branch/repository), but `workspace.json` in workspaceStorage provides the workspace URI

## Problem Statement

- Server discovery and parsing are hardcoded to CLI `~/.copilot/session-state/` assumptions.
- `SessionSummary` / `SessionDetail` have no `source` or `capabilities` fields, so the client cannot distinguish source-specific semantics.
- `isOpen` is determined solely by `inuse.*.lock` files, which do not exist for VS Code sessions.
- `injectMessage` blindly appends to `events.jsonl`; this is unsafe for VS Code sessions.
- Artifact and DB inspection routes assume CLI directory layout (`plan.md`, `checkpoints/`, `session.db`).

## Goals (Baseline)

1. Ingest and display VS Code transcript-backed sessions together with CLI sessions.
2. Preserve existing CLI behavior with **zero regressions**.
3. Use existing event-parsing pipeline for transcripts (no duplicate parsing logic).
4. Expose `source` and a minimal `capabilities` object so UI semantics remain accurate.
5. Block injection for non-CLI sessions with a clear error.
6. Provide an opt-in feature toggle so users can enable/disable VS Code session visibility from the dashboard.

## Non-Goals (Baseline)

- **chatSessions fallback provider** — patch-log parsing (`kind: 1|2`) is non-trivial and deferred to a follow-up issue.
- **Provider architecture extraction** — existing CLI logic in `sessionReader.ts` stays intact; VS Code discovery is an additive module.
- **Client UI source badges** — server-side safe defaults are sufficient for baseline.
- **Full fidelity reconstruction from debug logs.**
- **Catalog integration for VS Code sessions** — `session-store.db` is CLI-only.
- **Search across VS Code sessions** — research artifact and catalog search remain CLI-only for now.
- **Supporting every historical VS Code schema revision on day one.**

## Requirements

- Add `source: 'cli' | 'vscode'` to `SessionSummary` / `SessionDetail`.
- Add a minimal `capabilities` object:
  ```ts
  interface SessionCapabilities {
    supportsInjection: boolean;      // can append to event stream
    supportsToolLifecycle: boolean;  // has tool.execution_start/complete events
    supportsPlanArtifacts: boolean;  // has plan.md, checkpoints/, session.db
  }
  ```
- Add VS Code workspaceStorage discovery as a **separate additive module** (`server/src/vscodeSessionReader.ts` or similar).
- Reuse existing `parseEventsFile()` and `buildMessages()` for transcript files.
- Determine `isOpen` for VS Code sessions by checking for the presence of `session.shutdown` in the transcript (no mtime heuristics).
- Derive `projectPath` from `workspace.json` workspace URI first; fall back to "VS Code" if unavailable.
- Add deterministic merge/dedupe policy across sources.
- Keep list/detail API shape backwards compatible for existing client consumers.
- Gate `needsAttention`, `isWorking`, `hasPlan`, `isPlanPending` by `capabilities.supportsToolLifecycle` and `capabilities.supportsPlanArtifacts`.
- Restrict message injection to `source === 'cli'` and `capabilities.supportsInjection === true`.
- Return graceful empty/missing responses for artifact and DB inspection routes on VS Code sessions.
- Add a server-side feature flag `COPILOT_VSCODE_SESSIONS` (default `false`). When disabled, the server skips VS Code discovery entirely and only CLI sessions are returned.
- Expose the feature flag state via `GET /api/config` or similar so the client can adapt UI when the feature is unavailable.
- Add a client-side toggle (e.g., checkbox/switch in `SessionList` or filter bar) that filters VS Code sessions in/out of the list view. Persist the user's preference in `localStorage`.
- When the server feature flag is disabled, the client toggle is hidden or shown as disabled with a tooltip explaining how to enable it.

## Acceptance Criteria

- [x] `/api/sessions` returns mixed CLI + VS Code sessions sorted by last activity.
- [x] CLI sessions retain 100% existing status and visualization behavior.
- [x] VS Code transcript-backed sessions render message/tool timeline in detail view.
- [x] VS Code sessions do not show false `needsAttention`, `isPlanPending`, or `isWorking` badges.
- [x] Injection endpoint returns `400` for non-CLI sessions with a clear error message.
- [x] Artifact routes return clean `404` / empty structures for VS Code sessions (no 500s).
- [x] DB inspection returns `missing_db` for VS Code sessions.
- [x] `npm run build` passes for both server and client.
- [x] No duplicate sessions in the list when the same ID appears across sources.
- [x] Feature toggle: when `COPILOT_VSCODE_SESSIONS=false`, `/api/sessions` returns only CLI sessions.
- [x] Feature toggle: when `COPILOT_VSCODE_SESSIONS=true`, client shows a working enable/disable switch for VS Code sessions.
- [x] Feature toggle: client persists the user's preference across reloads.
- [x] Feature toggle: when disabled on the server, client hides or disables the toggle with informative messaging.
- [x] VS Code sessions have readable titles from `debug-logs/<id>/title-*.jsonl`.

## Out of Scope (Follow-up Issues)

| Feature | Reason |
|---------|--------|
| chatSessions-only fallback | Patch-log parsing (`kind: 1|2`) requires a JSON patch engine. Acceptable to miss 102 chatSessions-only sessions in baseline. |
| Client source badges | Cosmetic; server safe defaults are sufficient. |
| Provider architecture refactor | Extract CLI provider only after VS Code baseline is stable and tested. |
| Full capability matrix (7 flags) | 3 flags cover baseline needs; expand later if required. |
| Catalog / search integration for VS Code | `session-store.db` and research artifact search are CLI-only. |

## Candidate Impacted Areas

### Server
- `server/src/sessionTypes.ts` — add `source`, `capabilities`
- `server/src/sessionReader.ts` — add VS Code list/detail call sites; keep CLI logic intact
- `server/src/router.ts` — merge lists; add injection guard; source-aware lookup
- `server/src/utils/needsAttention.ts` — gate by capability where appropriate

### New Server Files
- `server/src/vscodeSessionReader.ts` — workspaceStorage discovery, transcript parsing, normalization

### Client
- `client/src/api/client.ts` — add `source`, `capabilities` to types; add config fetcher
- `client/src/hooks/useSessions.ts` or filter state — respect VS Code visibility toggle
- `client/src/components/SessionList/` — add toggle control and filter logic

## Implementation Plan

### Pass 1 — Contracts and Minimal VS Code Discovery

1. Extend `server/src/sessionTypes.ts` with `source` and `SessionCapabilities`.
2. Extend `client/src/api/client.ts` with matching fields.
3. Create `server/src/vscodeSessionReader.ts`:
   - Scan `%APPDATA%/Code/User/workspaceStorage` and `%APPDATA%/Code - Insiders/User/workspaceStorage`.
   - Discover `GitHub.copilot-chat/transcripts/*.jsonl` files.
   - Parse `workspace.json` for workspace URI → `projectPath`.
   - Build `sessionId → { transcriptPath, workspacePath }` map.
   - Add caching with 60s TTL (`vscodeDiscoveryCache`).
4. Add `listAllVscodeSessions()` that returns `SessionSummary[]` using the existing `scanSessionSummary` logic adapted for transcript files.
5. Update `listAllSessions()` in `sessionReader.ts` to merge CLI + VS Code results.
6. Run build and verify no CLI regression.

### Pass 2 — VS Code Detail View and Router Guards

1. Add `parseVscodeSessionDir()` that feeds transcript events through existing `buildMessages()`, `buildActiveSubAgents()`, etc.
2. Update `parseSessionDir()` / router `GET /sessions/:id` to route to VS Code parser when the session ID is a VS Code session.
3. Add injection guard in router `POST /sessions/:id/message`: reject with `400` if `source !== 'cli'`.
4. Update artifact/DB routes to return graceful empty/404 responses for VS Code sessions.
5. Add source-aware session lookup helper (or extend `findSessionDir` to disambiguate).

### Pass 3 — Capability Gating and Safe Defaults

1. In `needsAttention.ts` and summary builders: skip `exit_plan_mode` / plan checks when `supportsPlanArtifacts: false`.
2. Set VS Code session capabilities:
   - `supportsInjection: false`
   - `supportsToolLifecycle: true` (transcripts have tool events)
   - `supportsPlanArtifacts: false` (no `plan.md`, `session.db`, `checkpoints/`)
3. Ensure `needsAttention`, `isWorking`, `isPlanPending`, `hasPlan` are derived safely.
4. Verify VS Code sessions never show misleading plan-review or attention badges incorrectly.

### Pass 4 — Feature Toggle Integration

1. Add server env var `COPILOT_VSCODE_SESSIONS` (default `false`).
2. Gate `listAllSessions()` and detail lookup: skip VS Code discovery when disabled.
3. Add `GET /api/config` endpoint returning `{ vscodeSessionsEnabled: boolean }`.
4. Add client toggle control in `SessionList` filter bar.
5. Persist toggle state in `localStorage` under `copiloting-agents.showVscodeSessions`.
6. Handle disabled-server state: hide or disable toggle with explanatory tooltip.

### Pass 5 — Reconciliation and Hardening

1. Run sample-based reconciliation:
   - Count parity across VS Code providers on sample workspace.
   - No regression in existing CLI list/detail outputs.
   - Status badge sanity check by source.
   - Workflow tab sanity check on transcript-backed sessions.
   - Injection route enforcement check.
2. Performance sanity check: ensure workspaceStorage scan doesn't spike CPU on large stores.
3. Document unsupported edge cases and create follow-up issue(s) for deferred scope.

## Merge and Dedupe Policy (Baseline)

1. **Key by `sessionId` only** (not by `(source, sessionId)`).
2. **Source precedence** (highest wins):
   1. `cli`
   2. `vscode`
3. If multiple discovery paths return the same `sessionId`, the highest-precedence source wins **entirely**. No field-level merging.
4. Log a warning if a collision occurs across sources (unlikely with UUIDs, but deterministic).

## isOpen Semantics by Source

| Source | Signal | Notes |
|--------|--------|-------|
| CLI | `inuse.<pid>.lock` file exists | Source of truth, existing behavior |
| VS Code | No `session.shutdown` event in transcript | Simple and deterministic; remove mtime heuristics |

## projectPath Derivation by Source

| Source | Primary | Fallback |
|--------|---------|----------|
| CLI | `session.start.context.cwd` | `workspace.yaml.cwd` |
| VS Code | `workspace.json` workspace URI | `"VS Code"` (human-readable placeholder) |

## Title Derivation by Source

| Source | Primary | Secondary | Fallback |
|--------|---------|-----------|----------|
| CLI | `workspace.yaml.summary` | First `user.message` content | `"Untitled session"` |
| VS Code | `debug-logs/<id>/title-*.jsonl` (LLM-generated) | First `user.message` or `assistant.message` content | Workspace folder name | `"Untitled session"` |

> **Note:** VS Code transcripts often start with `assistant.message` (no initial `user.message`), so the title chain must check both event types.

## CLI vs VS Code Session Data Structure Mapping

| Concept | CLI (`~/.copilot/session-state/<id>/`) | VS Code (`%APPDATA%/Code/User/workspaceStorage/<hash>/`) | Notes |
|---------|----------------------------------------|----------------------------------------------------------|-------|
| **Session ID** | Directory name (UUID) | `transcripts/<id>.jsonl` base name (UUID) | Same UUID format |
| **Event stream** | `events.jsonl` | `GitHub.copilot-chat/transcripts/<id>.jsonl` | Same `{type,data,id,timestamp,parentId}` envelope |
| **Session metadata** | `workspace.yaml` | `workspace.json` + `state.vscdb` | `workspace.json` has `workspaceUri`; `state.vscdb` is binary SQLite |
| **Session title** | `workspace.yaml.summary` | `debug-logs/<id>/title-*.jsonl` → `agent_response` | CLI: user-set via `/rename`; VS Code: LLM-generated by Copilot Chat |
| **Project path** | `session.start.context.cwd` | `workspace.json.workspaceUri` | VS Code: `file:///C:/...` URI converted to file path |
| **Git branch** | `session.start.context.branch` | Not available in transcript | VS Code: no git context in event envelope |
| **Lock / isOpen** | `inuse.<pid>.lock` file | Absence of `session.shutdown` in transcript | Different signals; no mtime heuristics for VS Code |
| **Message injection** | Append to `events.jsonl` | **Not supported** | VS Code: read-only ingestion |
| **Plan artifacts** | `plan.md`, `checkpoints/` | Not present | VS Code: `supportsPlanArtifacts: false` |
| **Per-session DB** | `session.db` (SQLite) | Not present | VS Code: `missing_db` on inspection |
| **Sub-agent events** | `subagent.started`, `subagent.completed` | Same event types in transcript | Reuse `buildActiveSubAgents()` |
| **Tool lifecycle** | `tool.execution_start`, `tool.execution_complete` | Same event types in transcript | Reuse `buildMessages()` |
| **Research artifacts** | `research/` directory | Not present | VS Code: search returns CLI-only results |
| **chatSessions fallback** | N/A | `chatSessions/*.jsonl` (patch-log `kind: 0\|1\|2`) | Deferred: requires JSON patch engine |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VS Code schema drift in transcripts | Medium | High | Version-guard parsing; unknown event types are safely ignored by existing pipeline |
| Large workspaceStorage scan latency | Medium | Medium | 60s discovery cache; per-session file signature cache |
| Duplicate type definitions (server/client) | Low | Low | Add fields to both `sessionTypes.ts` and `client.ts` in the same commit |
| Capability mismatch causing incorrect status | Low | High | Strict gating in summary builders; safe defaults for VS Code |
| Session ID collision across sources | Very Low | Medium | Source precedence policy; log warning |

## Reconciliation Checklist

- [ ] Count parity: VS Code transcript sessions appear in `/api/sessions`.
- [ ] No regression: CLI list/detail outputs match pre-change behavior.
- [ ] No duplicates: same `sessionId` never appears twice in the list.
- [ ] Status badges: VS Code sessions show accurate state (not false plan-review/attention).
- [ ] Detail view: transcript-backed sessions render messages, tool calls, and sub-agents correctly.
- [ ] Injection guard: `POST /api/sessions/:id/message` returns `400` for VS Code sessions.
- [ ] Artifacts: `GET /api/sessions/:id/artifacts` returns empty/missing for VS Code (no 500).
- [ ] DB inspection: `GET /api/sessions/:id/session-db` returns `missing_db` for VS Code.
- [ ] Build: `npm run build` passes for server and client.

## Follow-up Issues to Create

1. **chatSessions fallback provider** — ingest the 102 chatSessions-only sessions with patch-log parsing.
2. **Provider architecture refactor** — extract CLI provider and formalize provider interface once baseline is stable.
3. **Client UI source badges** — add visual source indicator in `SessionCard` / `SessionRow`.
4. **Catalog integration for VS Code** — investigate populating `session-store.db` with VS Code sessions.

## References

- `AGENTS.md`
- `server/src/sessionReader.ts`
- `server/src/sessionTypes.ts`
- `server/src/utils/needsAttention.ts`
- `server/src/router.ts`
- `client/src/api/client.ts`
- `.docs/reference/session-state/session-data-model.md`
