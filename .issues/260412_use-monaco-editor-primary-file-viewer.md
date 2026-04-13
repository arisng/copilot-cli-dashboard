---
title: "Adopt Monaco Editor as the primary artifact file viewer"
type: "Feature"
status: "Implemented"
author: "Copilot"
created: "2026-04-12"
completed: "2026-04-13"
priority: "High"
---

## Summary

The first implementation pass introduced Monaco-based source viewing, but UAT shows the rollout is incomplete and the issue should remain open for follow-up.

Primary target file types include:
- `.md`
- `.txt`
- `.json`
- `.yaml`
- `.yml`
- `.html`
- `.css`
- `.js`
- `.sql`
- other text/code-like files that map cleanly to Monaco language modes

The remaining work is to unify viewer behavior across `Files`, `Plan`, `Checkpoints`, and `Research`, make Monaco fill its container correctly, and add a first-class markdown `Preview` mode with rich media support plus an explicit `Source` mode backed by Monaco.

## Problem Statement

- Monaco is currently visible in the `Files` tab, but UAT confirms that `Plan`, `Checkpoints`, and `Research` still fall back to the old markdown renderer path instead of using the same viewer system.
- The shared `ArtifactViewer` still short-circuits to `MarkdownRenderer` when `forceMarkdown` is set, which means some artifact surfaces bypass Monaco and any future unified preview/source controls.
- The Monaco container is still using a fixed `600px` height instead of expanding to the size of its direct parent container, so the layout is visibly clipped or under-filled.
- Markdown files currently show raw source in Monaco instead of a polished preview-first experience, which is not the right default for document-style artifacts such as `plan.md`, checkpoints, or research notes.
- Markdown preview needs to support embedded media cleanly, including images, GIFs, and video, without regressing existing fallback behavior or safety constraints.

## Goals

1. Unify desktop artifact viewing behavior across `Files`, `Plan`, `Checkpoints`, and `Research` so they all use the same viewer-selection model.
2. Keep Monaco as the desktop source viewer for supported non-markdown text/code artifacts.
3. Make markdown artifacts open in a polished `Preview` mode by default, with an explicit `Source` mode that uses Monaco.
4. Ensure the Monaco surface fills the available width and height of its direct container instead of relying on a hard-coded height.
5. Preserve the existing image preview flow and safe fallback behavior for unsupported, unreadable, or empty files.
6. Avoid degrading the current mobile experience by keeping a documented fallback where Monaco is not officially supported.

## Requirements

- [x] Add Monaco using the official `monaco-editor` package and a Vite-compatible integration approach.
- [x] Introduce a shared artifact viewer component for supported text/code files instead of branching separately across desktop and mobile surfaces.
- [x] Define extension-to-language mapping in one place so viewer behavior is consistent across artifact surfaces.
- [x] Use stable model URIs derived from session id and artifact path so Monaco can infer language and maintain expected model semantics.
- [x] Dispose Monaco editors and models correctly when switching files, sessions, or unmounting views.
- [x] Lazy-load Monaco so initial dashboard load does not pay the editor bundle cost before a supported file is opened.
- [x] Apply a dashboard-aligned read-only theme so Monaco does not visually clash with the existing GitHub-inspired dark UI.
- [x] Keep `ImagePreview` as the primary viewer for image files.
- [x] Preserve a non-Monaco fallback for unsupported file types, missing text content, or files that should not be loaded into Monaco.
- [x] Keep mobile artifact viewing functional using the current lightweight renderer or another documented fallback, because Monaco is not officially supported in mobile browsers.
- [x] Remove the current `forceMarkdown` bypass so `Plan`, `Checkpoints`, and `Research` participate in the same desktop viewer-selection flow as `Files`.
- [x] Replace the boolean `forceMarkdown` override with an explicit viewer-mode contract such as `auto | preview | source`.
- [x] Route supported non-markdown text/code files such as `.txt`, `.json`, `.yaml`, `.yml`, `.html`, `.css`, `.js`, and `.sql` into Monaco source mode across all desktop artifact surfaces.
- [x] Make markdown artifacts default to `Preview` mode across artifact surfaces, with a clearly visible `Source` toggle that opens the same file in Monaco.
- [x] Ensure markdown preview mode is implemented through the shared artifact viewer pathway rather than through a separate legacy rendering branch.
- [x] Extend markdown preview to render media content cleanly, including image, GIF, and video content.
- [x] Remove the fixed Monaco height and make the editor fill the width and height of its direct container.
- [x] Trigger `editor.layout()` from container size changes, not only from window resize events.
- [x] Add or update tests for viewer-mode selection, tab parity, markdown preview/media rendering, and responsive Monaco sizing.
- [ ] Update client-facing documentation for supported file types, fallbacks, and any markdown preview toggle behavior.

## Acceptance Criteria

- [x] Monaco is integrated and used for supported source/text viewing in the desktop `Files` tab.
- [x] Opening `Plan` uses the same shared artifact viewer system and no longer falls back to a separate legacy markdown-only path.
- [x] Opening files in `Checkpoints` and `Research` no longer bypass Monaco/source mode because of a `forceMarkdown` short-circuit.
- [x] Supported non-markdown text/code files in `Files`, `Checkpoints`, and `Research` render in Monaco source mode on desktop.
- [x] Markdown artifacts open in `Preview` mode by default and provide an explicit `Source` mode backed by Monaco.
- [x] Preview mode renders headings, lists, tables, code blocks, images, GIFs, and video content in a polished layout.
- [x] Monaco expands to fill the width and height of its direct container without a hard-coded `600px` cap.
- [x] Image files still open through the existing image preview experience.
- [x] Unsupported or empty files show a clear fallback state instead of a broken editor shell.
- [x] The Monaco viewer remains lazy-loaded and does not regress the initial route load for users who never open a supported file.
- [x] Switching between files does not leak Monaco models or leave stale content mounted.
- [x] Mobile users continue to have a working file-viewing path, with Monaco either deliberately excluded or feature-gated based on supportability.
- [ ] Documentation explains the supported file matrix, viewer-mode behavior, and markdown preview/media constraints.

## Candidate Impacted Areas

- `client/package.json`
- `client/src/components/shared/ArtifactViewer/ArtifactViewer.tsx`
- `client/src/components/shared/MonacoEditor/MonacoEditor.tsx`
- `client/src/components/shared/MarkdownRenderer/MarkdownRenderer.tsx`
- `client/src/components/SessionDetail/SessionDetail.tsx`
- `client/src/components/mobile/MobileSessionPane.tsx`
- `client/src/utils/fileUtils.ts`
- `docs/client.md`

## Implementation Approach

1. Keep the current Monaco integration, shared artifact viewer abstraction, and extension/language mapping as the base layer.
2. Replace the current `forceMarkdown` boolean with a viewer-mode API so the viewer can distinguish between `auto`, `preview`, and `source` instead of hard-bypassing Monaco.
3. Default markdown files to `Preview` mode across desktop artifact surfaces, while keeping non-markdown source-like files in Monaco by default.
4. Add an explicit `Preview | Source` control for markdown artifacts so users can switch between rendered output and raw source without leaving the selected file.
5. Unify `Plan`, `Checkpoints`, and `Research` with the same `ArtifactViewer` decision path used by `Files` so the chosen mode applies consistently across tabs.
6. Extend markdown preview rendering to support rich media:
   - standard markdown images and GIFs via `img`
   - safe video rendering for supported local or remote media sources
   - graceful fallback for unsupported or blocked media types
7. Replace the fixed Monaco height with container-driven sizing using `h-full` / `min-h-0` style constraints and a `ResizeObserver`-driven `editor.layout()` call.
8. Update tests and docs so UAT expectations match the actual shipped behavior.

The viewer system should still answer these three questions consistently:

1. should this file use Monaco source mode?
2. should this file use markdown preview mode?
3. what fallback renderer should it use when neither is appropriate?

## Risks

- Monaco still adds bundle weight and worker setup complexity relative to the current renderer stack.
- Preview/source mode switching introduces new state that can drift if the selected mode is not scoped correctly per file or per artifact tab.
- Rich markdown media rendering needs a clear sanitization and allowlist policy so video and HTML-based embeds do not create unsafe rendering behavior.
- Container sizing in nested flex/grid layouts can still break if surrounding panes do not propagate `min-h-0` and full-height constraints correctly.
- Attempting to force Monaco into mobile browsers would still conflict with the official support guidance and could degrade touch usability.

## Current Implementation State

### Delivered In The First Pass

- Monaco dependencies were added and lazy-loaded.
- A shared `ArtifactViewer` abstraction was introduced.
- Supported desktop source-like files in the `Files` tab now render in Monaco.
- The Monaco source view uses shared file classification, language mapping, model URIs, and cleanup behavior.
- Mobile still falls back to the lightweight renderer instead of forcing Monaco.

### Gaps Confirmed By UAT

- `Plan`, `Checkpoints`, and `Research` are not yet behaviorally aligned with `Files`.
- The current `forceMarkdown` flow keeps some artifact views on the legacy markdown renderer.
- Monaco does not yet fill its direct container height.
- Markdown documents do not yet have a polished preview-first experience with an explicit source toggle.
- Rich media rendering for markdown preview is not yet defined or implemented.

## UAT Feedback Incorporated On 2026-04-13

- Clicking `Plan` still shows the old markdown viewer instead of the unified Monaco/preview system.
- `Checkpoints` and `Research` still behave differently from `Files`.
- Monaco sizing does not fully expand to the direct container.
- Raw markdown source is not the desired default experience for `.md` content.
- Preview mode needs to render media content such as image, GIF, and video cleanly.

## Proposed Follow-up Solution

1. Reopen the issue as a follow-up completion pass instead of treating the original acceptance criteria as fully satisfied.
2. Replace `forceMarkdown` with a viewer-mode contract so `Plan`, `Checkpoints`, `Research`, and `Files` all go through the same viewer selection logic.
3. Default markdown files to `Preview` mode and add an explicit `Source` toggle that uses Monaco for raw content inspection.
4. Keep Monaco as the default desktop viewer for supported non-markdown text/code files.
5. Extend markdown preview with custom media rendering rules for image, GIF, and video while maintaining sanitization and graceful fallbacks.
6. Make the Monaco container inherit its parent's available height and trigger layout from container resize, not only global window resize.
7. Update `docs/client.md` so the final behavior is documented before the issue is marked complete again.

## Out of Scope

- Editing artifact files and writing changes back to disk.
- LSP-backed completions, hover providers, or full IDE behavior.
- Replacing the existing image viewer.
- Solving Monaco support for mobile browsers beyond a deliberate fallback strategy.

## References

- Monaco homepage: https://microsoft.github.io/monaco-editor/
- Monaco GitHub repository: https://github.com/microsoft/monaco-editor
- Monaco playground: https://microsoft.github.io/monaco-editor/playground.html
- Monaco accessibility guidance: https://github.com/microsoft/monaco-editor/wiki/Accessibility-Guide-for-Integrators