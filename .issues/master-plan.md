---
title: "Master Plan: Copilot Sessions Dashboard 2026 Q2"
type: "Plan"
status: "Active"
author: "Copilot"
created: "2026-04-02"
priority: "High"
---

## Executive Summary

The Copilot Sessions Dashboard is a local-first, real-time monitoring surface for GitHub Copilot CLI sessions. It bridges the gap between terminal-based agent workflows and visual oversight by reading session state directly from disk and presenting it through both desktop and mobile web interfaces.

This master plan defines the strategic roadmap for Q2 2026, focusing on three pillars:
1. **Desktop Density & Control** — richer session detail layouts and multi-session oversight.
2. **Artifact Intelligence** — exposing session artifacts (plans, checkpoints, research, files, DB) as first-class UI surfaces.
3. **Cross-Platform Polish** — ensuring mobile and desktop experiences are consistent, accessible, and performant.

---

## Current State (As of 2026-04-02)

### Completed
- ✅ Core session discovery via `~/.copilot/session-state/` and SQLite catalog.
- ✅ Real-time polling API and client hooks (`useSessions`, `useSession`).
- ✅ Desktop session list with filtering, sorting, pagination, grid/list toggle.
- ✅ Desktop session detail with message thread, tool inspection, plan view, todos, and sub-agent tabs.
- ✅ Mobile-optimized namespace (`/m`) with touch-first list and detail views.
- ✅ Shared markdown renderer with support for tables, code blocks, nested lists, and mixed XML-like content.
- ✅ Browser notification support for sessions needing attention.
- ✅ Dev Tunnels integration for remote access.
- ✅ **Desktop multi-session watch mode** — bulk selection from the list, side-by-side panes reusing the mobile session layout (`/watch`).

### In Progress / Recently Proposed
- 🔄 Desktop session detail three-column responsive layout (no-scroll primary experience).
- 🔄 Session artifact tabs in desktop detail: Checkpoints, Research, Files.
- 🔄 Session DB inspection and visualization panel.
- 🔄 Image file rendering for session artifacts.
- 🔄 Vertical tab navigation for desktop detail view to reduce horizontal overflow.

---

## Strategic Pillars

### Pillar 1: Desktop Density & Control
**Goal:** Make the desktop dashboard the definitive command center for users running multiple Copilot sessions in parallel.

**Key Initiatives:**
| Initiative | Status | Issue Reference |
|---|---|---|
| Multi-session watch mode (side-by-side panes) | ✅ Completed | `260402_desktop-multi-session-watch-mode-side-by-side-panes.md` |
| Overview panel with session pulse & metadata | ✅ Completed | `260323_enhance-desktop-session-uxui.md` |
| Three-column desktop detail layout | 🔄 Proposed | `260402_session-detail-column1-cap-500px-column2-fill-remaining-space.md` |
| Force primary two-column layout for detail | 🔄 Proposed | `260323_session-detail-force-column-2-primary-layout.md` |
| Vertical tab navigation for detail view | 🔄 Proposed | `260325_session-detail-column2-vertical-tabs-filter.md` |

**Success Criteria:**
- A user can monitor 4+ sessions simultaneously without scrolling the primary viewport horizontally on a 1440p display.
- Session detail surfaces all critical context (status, agents, todos, last message) above the fold.
- Keyboard navigation is fully supported across lists, tabs, and panes.

---

### Pillar 2: Artifact Intelligence
**Goal:** Transform static session directories into browsable, searchable, and readable content surfaces.

**Key Initiatives:**
| Initiative | Status | Issue Reference |
|---|---|---|
| Unified markdown rendering for artifacts | ✅ Completed | `260331_enhance-markdown-rendering-desktop-mobile-surfaces.md` |
| Add artifact tabs: Plan, Checkpoints, Research | 🔄 Proposed | `260325_session-detail-add-cli-session-artifacts-tabs.md` |
| Session DB inspection & visualization | 🔄 Proposed | `260325_session-detail-session-db-inspection-visualization.md` |
| Render image files from session artifacts | 🔄 Proposed | `260401_support-render-image-file-session-artifact.md` |
| Sort todos by latest-first / stack order | 🔄 Proposed | `260402_sort-todos-tab-by-latest-first-stack-order.md` |

**Success Criteria:**
- Users can read `plan.md`, checkpoint files, research notes, and session DB tables without leaving the dashboard.
- Missing or empty artifact folders show helpful empty states with expected filesystem paths.
- Image previews work for common formats (PNG, JPG, GIF, WEBP) stored in the session `files/` directory.

---

### Pillar 3: Cross-Platform Polish
**Goal:** Ensure mobile and desktop share a unified design language, consistent data fidelity, and accessible interaction patterns.

**Key Initiatives:**
| Initiative | Status | Issue Reference |
|---|---|---|
| Mobile namespace with dedicated routes | ✅ Completed | Built-in (`/m`) |
| Filter unknown context by default in session list | ✅ Completed | `260324_session-list-filter-unknown-context-default.md` |
| Responsive detail layout refinements | 🔄 Proposed | `260323_desktop-session-detail-three-column-layout-no-scroll.md` |
| Overview column redesign | 🔄 Proposed | `260326_session-detail-overview-column-redesign.md` |
| Column 2 UX/UI feedback integration | 🔄 Proposed | `260325_session-detail-column2-uxui-feedback.md` |

**Success Criteria:**
- No layout breakage below 360px width (mobile) or above 2560px width (ultrawide desktop).
- ARIA labels and keyboard shortcuts pass manual accessibility review.
- All new desktop features have a graceful degradation path on mobile (either adapted UI or omitted with clear rationale).

---

## Phased Roadmap

### Phase 1: Foundation (Complete)
- Session discovery, polling API, and list/detail views.
- Mobile namespace parity.
- Notification system.

### Phase 2: Layout & Oversight (In Progress)
- ✅ Multi-session watch mode.
- ✅ Overview panel and desktop density improvements.
- 🔄 Three-column / two-column primary detail layout.
- 🔄 Vertical tabs and responsive column behavior.

### Phase 3: Artifact Surfaces (Next)
- Artifact explorer tabs (Checkpoints, Research, Files).
- Image rendering support.
- Session DB inspection panel.
- Todo sorting and grouping enhancements.

### Phase 4: Scale & Polish (Future)
- Full-text search across session messages and artifacts.
- Historical session analytics (time spent, model usage trends).
- Keyboard shortcuts and power-user interactions.
- Optional WebSocket backend to reduce polling overhead.

---

## Architecture Principles

1. **Local-First, Zero Cloud** — All data comes from the user’s filesystem. No external APIs.
2. **Mobile Shell Reuse** — Compact session UIs (like watch panes) should reuse the mobile layout rather than creating one-off desktop shells.
3. **Minimal Intrusions** — Prefer extending existing components over rewriting them. Strict mode TypeScript, Tailwind-only styling.
4. **Progressive Enhancement** — Desktop gets the richest features; mobile gets a readable, performant subset.

---

## Acceptance Criteria for the Master Plan

- [ ] All Phase 2 items are resolved or explicitly deprioritized with rationale.
- [ ] Phase 3 artifact tabs are available in desktop detail view.
- [ ] Mobile experience shows no regressions after each desktop enhancement.
- [ ] Build remains green (`npm run build` passes for both server and client).
- [ ] Documentation in `AGENTS.md`, `docs/client.md`, and `docs/server.md` stays synchronized with architectural changes.

---

## Notes

- This plan is a living document. As issues are resolved, their status should be updated in the respective `.issues/` files and this master plan should be revised quarterly.
- New feature requests should be written as individual `.issues/` documents and then linked here under the appropriate pillar and phase.
- The watch mode implementation (`/watch`) established a pattern for multi-session desktop composition that should be reused for any future dashboard-wide workspaces or layouts.
