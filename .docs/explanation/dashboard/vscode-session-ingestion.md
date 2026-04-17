---
title: VS Code Session Ingestion Design
description: Why and how the dashboard ingests Copilot VS Code sessions alongside CLI sessions.
---

# VS Code Session Ingestion Design

## Context

The dashboard was originally built around CLI sessions stored in `~/.copilot/session-state/`. VS Code sessions live in `%APPDATA%/Code/User/workspaceStorage/` and use the same `{ type, data, id, timestamp, parentId }` event envelope, which made transcript-first ingestion possible with minimal parsing changes.

## Key Design Decisions

### 1. Additive Module, Not Refactor

Rather than extracting a provider interface immediately, VS Code discovery lives in a separate `vscodeSessionReader.ts` module. The existing CLI logic in `sessionReader.ts` stays intact. This avoids regressions in a critical path while the new source stabilizes.

**Lesson:** When adding a new data source to an existing parser, keep the original path untouched until the new path is battle-tested.

### 2. Capability Gating Over Source Branching

Instead of peppering `if (source === 'vscode')` throughout the UI and server logic, we added a `capabilities` object to every `SessionSummary`:

```ts
interface SessionCapabilities {
  supportsInjection: boolean;
  supportsToolLifecycle: boolean;
  supportsPlanArtifacts: boolean;
}
```

This lets the client and server reason about what a session can do, not where it came from.

**Lesson:** Capabilities are more stable than source checks. A future provider (e.g., JetBrains) can set the same three flags and reuse the UI logic with zero client changes.

### 3. Circular Dependency Trap

`vscodeSessionReader.ts` initially imported `buildMessages` and `buildActiveSubAgents` from `sessionReader.ts`, while `sessionReader.ts` imported `listAllVscodeSessions` and `parseVscodeSessionDir` from `vscodeSessionReader.ts`. Node.js resolved this at runtime, but it was fragile.

We broke the cycle by extracting the message-building functions into `utils/messageBuilder.ts`, which both modules import.

**Lesson:** Shared parsing utilities should live in a leaf module that has no upstream imports.

### 4. isOpen Semantics Differ by Source

| Source | Signal |
|--------|--------|
| CLI | `inuse.<pid>.lock` file exists |
| VS Code | No `session.shutdown` event in transcript |

These are fundamentally different signals. A CLI session is open if a process holds a lock. A VS Code session is open if the transcript lacks a shutdown event. We do not use mtime heuristics for VS Code because transcript events are authoritative.

### 5. Merge Precedence

If the same `sessionId` appears in both CLI and VS Code sources, CLI wins entirely. This is unlikely with UUIDs, but deterministic policies prevent undefined behavior.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| VS Code schema drift | Unknown event types are safely ignored by the existing pipeline |
| Large workspaceStorage scan | 60-second discovery cache + per-session file signature cache |
| Incorrect status badges for VS Code | `supportsPlanArtifacts: false` forces `hasPlan = false` and `isPlanPending = false` |

## Follow-up Work

- **chatSessions fallback:** Patch-log parsing (`kind: 1|2`) for sessions without transcripts
- **Provider architecture refactor:** Extract formal `SessionProvider` interface once baseline is stable
- **Client source badges:** Visual indicators in `SessionCard` / `SessionRow`
