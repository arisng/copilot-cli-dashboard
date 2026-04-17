---
title: "Feature Plan: Ingest Copilot VS Code sessions in dashboard"
type: "Feature"
status: "Planned"
author: "GitHub Copilot"
created: "2026-04-17"
priority: "High"
description: "Baseline implementation and reconciliation plan to add Copilot VS Code session ingestion alongside existing Copilot CLI sessions."
---

# Feature Plan: Ingest Copilot VS Code sessions in dashboard

## Summary

This issue is the baseline plan for iterative development and reconciliation of VS Code session ingestion.

Current dashboard ingestion is CLI-only and assumes `~/.copilot/session-state/<id>/events.jsonl` semantics.
VS Code sessions in the provided sample are distributed across workspace storage and require source-aware adapters:

- transcript-first ingestion for full event timeline
- chatSessions fallback for metadata-only coverage
- capability-aware status and UI rendering to avoid false signals

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
4. Conclusion:
	- transcript-only ingestion would miss most VS Code sessions in this sample
	- chatSessions fallback is required for list completeness

## Problem Statement

- Server parser and status logic are hardcoded to CLI directory and event assumptions.
- Client models and UI assume one source and one capability level.
- Without source-aware normalization, VS Code sessions will either fail parsing, be silently dropped, or render incorrect status/tool semantics.

## Goals

1. Ingest and display Copilot VS Code sessions together with CLI sessions.
2. Preserve existing CLI behavior with no regressions.
3. Provide best-effort VS Code fidelity using transcript-first + chatSessions fallback.
4. Expose source and capabilities so UI semantics remain accurate.
5. Establish reconciliation checkpoints for iterative rollout.

## Non-Goals (Phase 1)

- Full fidelity reconstruction from debug logs.
- Supporting every historical VS Code schema revision on day one.
- Message injection for VS Code sessions.
- Refactor of unrelated search, retention, or artifact features beyond required safety gates.

## Requirements

- Add source identity to normalized session DTOs (`cli`, `vscode-transcript`, `vscode-chatstate`).
- Add capability flags (example: supportsToolLifecycle, supportsModeTracking, supportsInjection, supportsSubAgentThreading).
- Introduce provider architecture in server ingestion pipeline:
  - CLI provider (existing behavior)
  - VS Code transcript provider (primary)
  - VS Code chatSessions provider (fallback)
- Add deterministic merge and dedupe policy across providers.
- Keep list/detail API shape backwards compatible for existing client consumers, while extending with source/capabilities.
- Make `needsAttention` and related status derivation capability-aware.
- Restrict message injection to sources that support appendable timeline writes (CLI only).

## Acceptance Criteria

- `/api/sessions` returns mixed-source sessions sorted by last activity.
- CLI sessions retain existing status and visualization behavior.
- Transcript-backed VS Code sessions render message/tool timeline in detail view.
- ChatSessions-only VS Code sessions appear in list with reduced capability flags and safe status defaults.
- UI clearly indicates source and does not show misleading badges for unsupported capabilities.
- Injection endpoint rejects non-CLI sessions with explicit error.
- Repo builds successfully with `npm run build`.

## Candidate Impacted Areas

- `server/src/sessionReader.ts`
- `server/src/sessionTypes.ts`
- `server/src/utils/needsAttention.ts`
- `server/src/router.ts`
- `client/src/api/client.ts`
- `client/src/components/SessionList/SessionStatusBadge.tsx`
- `client/src/components/shared/modeBadge.tsx`
- `client/src/components/SessionDetail/MessageBubble.tsx`
- `client/src/components/SessionDetail/WorkflowTopologyView.tsx`

## Implementation Plan (Iterative)

### Pass 1 - Contracts and Provider Skeleton

1. Extend server/client DTOs with source + capability metadata.
2. Create provider interfaces and move existing CLI logic behind CLI provider.
3. Keep functional parity for CLI and run build.

### Pass 2 - VS Code Transcript Provider

1. Add VS Code workspaceStorage discovery.
2. Parse transcript JSONL and normalize to internal event model.
3. Enable summary/detail for transcript-backed sessions.
4. Add tests/fixtures for transcript parsing.

### Pass 3 - VS Code chatSessions Fallback

1. Parse chatSessions `kind` records for metadata coverage.
2. Produce reduced-capability summaries when transcripts are absent.
3. Merge transcript + chatSessions with precedence to transcript detail.

### Pass 4 - Status and UI Capability Gating

1. Gate attention/working/plan status by capability.
2. Add source badge and degrade unsupported UI affordances.
3. Ensure workflow/detail tabs fail gracefully on reduced-capability sessions.

### Pass 5 - Reconciliation and Hardening

1. Run sample-based reconciliation checks (session counts and overlap).
2. Resolve mismatches and document unsupported edge cases.
3. Add follow-up issue(s) for remaining fidelity gaps.

## Merge and Dedupe Policy (Baseline)

1. Key by `(source, sessionId)` to prevent cross-source collisions.
2. If both transcript and chatSessions exist for same VS Code session id:
	- transcript provides detail timeline
	- chatSessions may contribute metadata if transcript lacks it
3. Include transcript-only sessions and chatSessions-only sessions.

## Risks

- VS Code schema drift could break transcript/chatSessions parsing.
- Capability mismatch can produce incorrect status if not strictly gated.
- Duplicate type definitions (server/client) increase drift risk without shared contract discipline.
- Large session stores may increase scan latency unless caching/signatures are adapted.

## Reconciliation Checklist

- [ ] Count parity check across VS Code providers on sample workspace.
- [ ] No regression in existing CLI list/detail outputs.
- [ ] Status badge sanity check by source and capability.
- [ ] Workflow tab sanity check on transcript-backed sessions.
- [ ] Injection route enforcement check on VS Code sessions.

## References

- `AGENTS.md`
- `server/src/sessionReader.ts`
- `server/src/sessionTypes.ts`
- `server/src/utils/needsAttention.ts`
- `server/src/router.ts`
- `client/src/api/client.ts`
- `.docs/reference/session-state/session-data-model.md`
