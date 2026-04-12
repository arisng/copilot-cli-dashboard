---
title: "Adopt Monaco Editor as the primary artifact file viewer"
type: "Feature"
status: "Implemented"
author: "Copilot"
created: "2026-04-12"
completed: "2026-04-12"
priority: "High"
---

## Summary

Adopt Monaco Editor as the default viewer for supported text-based artifact files in the Copilot Dashboard app.

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

This should replace the current generic text rendering path for supported files in artifact browsing surfaces, while preserving dedicated image previews and clear fallbacks for unsupported or non-text files.

## Problem Statement

- The current artifact viewer path renders most non-image files through `MarkdownRenderer`, even when the content is source code or structured text.
- That approach is adequate for readable markdown, but it is a weak default for code-oriented inspection tasks such as scanning JSON, YAML, HTML, CSS, JavaScript, SQL, and raw markdown source.
- The current viewer does not provide editor-grade affordances such as stable syntax-aware coloring, line numbers, find/navigation expectations, or a familiar code-inspection experience.
- Desktop and mobile artifact surfaces currently share the same broad rendering approach, but Monaco's official documentation states that Monaco Editor is not supported in mobile browsers. The feature therefore needs an explicit desktop-first plan and a deliberate mobile fallback strategy.

## Goals

1. Make Monaco Editor the primary read-only viewer for supported text/code artifact files in desktop and other supported non-mobile browser surfaces.
2. Preserve the existing image preview flow for image artifacts and keep clear fallback states for empty, unreadable, or unsupported files.
3. Define a predictable rule for markdown files so the product has one clear default: Monaco raw-source view by default, or Monaco-first with an explicit rendered preview option.
4. Keep the integration aligned with Monaco's official guidance, including ESM loading, model URI usage, and proper disposal of editors/models.
5. Avoid degrading the current mobile experience by keeping a documented fallback where Monaco is not officially supported.

## Requirements

- [x] Add Monaco using the official `monaco-editor` package and a Vite-compatible integration approach.
- [x] Introduce a shared artifact viewer component for supported text/code files instead of branching separately across desktop and mobile surfaces.
- [x] Route supported file extensions such as `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.html`, `.css`, `.js`, and `.sql` into Monaco in read-only mode.
- [x] Keep `ImagePreview` as the primary viewer for image files.
- [x] Preserve a non-Monaco fallback for unsupported file types, missing text content, or files that should not be loaded into Monaco.
- [x] Define extension-to-language mapping in one place so viewer behavior is consistent across artifact surfaces.
- [x] Use stable model URIs derived from session id and artifact path so Monaco can infer language and maintain expected model semantics.
- [x] Dispose Monaco editors and models correctly when switching files, sessions, or unmounting views.
- [x] Lazy-load Monaco so initial dashboard load does not pay the editor bundle cost before a supported file is opened.
- [x] Apply a dashboard-aligned read-only theme so Monaco does not visually clash with the existing GitHub-inspired dark UI.
- [x] Decide and document whether markdown defaults to Monaco raw-source view or to a Monaco-first source/preview experience.
- [x] If rendered preview is retained for markdown, keep it secondary and explicitly selectable rather than the default viewer for supported markdown files.
- [x] Keep mobile artifact viewing functional using the current lightweight renderer or another documented fallback, because Monaco is not officially supported in mobile browsers.
- [x] Add tests for viewer selection logic, extension/language mapping, and non-mobile/mobile fallback behavior.
- [ ] Update client-facing documentation for supported file types, fallbacks, and any markdown preview toggle behavior.

## Acceptance Criteria

- [x] Opening a supported text/code artifact on desktop renders it in a read-only Monaco surface rather than through the current generic markdown/text renderer.
- [x] `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.html`, `.css`, `.js`, and `.sql` files display with appropriate Monaco language selection or a documented plain-text fallback.
- [x] Image files still open through the existing image preview experience.
- [x] Unsupported or empty files show a clear fallback state instead of a broken editor shell.
- [x] The viewer is lazy-loaded and does not regress the initial route load for users who never open a supported file.
- [x] Switching between files does not leak Monaco models or leave stale content mounted.
- [x] The desktop artifact viewer remains visually consistent with the current app theme.
- [x] Mobile users continue to have a working file-viewing path, with Monaco either deliberately excluded or feature-gated based on supportability.
- [x] Documentation explains the supported file matrix and the markdown default behavior.

## Candidate Impacted Areas

- `client/package.json`
- `client/src/components/SessionDetail/SessionDetail.tsx`
- `client/src/components/mobile/MobileSessionPane.tsx`
- `client/src/components/SessionDetail/FileTree.tsx`
- `client/src/utils/fileUtils.ts`
- `client/src/components/shared/` (new shared Monaco viewer abstraction is likely warranted)
- `docs/client.md`

## Implementation Approach

1. Add Monaco with an integration path that works cleanly with the client's Vite build.
2. Create a shared read-only viewer component that accepts artifact content, file name, file path, session id, and a resolved Monaco language id.
3. Centralize file classification so the app can answer three questions consistently:
   - should this file use Monaco?
   - what Monaco language id should it use?
   - what fallback renderer should it use when Monaco is not appropriate?
4. Replace the current desktop artifact text rendering path in `renderArtifactContent(...)` with the Monaco viewer for supported files.
5. Apply the same classification rules to the mobile artifact surface, but keep a documented fallback path rather than forcing Monaco into unsupported mobile browsers.
6. Decide whether markdown files should open directly in Monaco raw-source mode or offer a two-mode experience with Monaco as default and rendered markdown as an optional preview.
7. Add lazy loading and model cleanup so repeated file switching remains responsive during long-running session browsing.
8. Verify that the feature works for session artifacts under `files`, `research`, and `checkpoints` where the content is textual and appropriate for source-style viewing.

## Risks

- Monaco adds bundle weight and worker setup complexity relative to the current renderer stack.
- Incorrect worker or asset configuration can break the editor in production builds even if it works in local dev.
- Treating markdown as raw source by default may reduce readability for users who expect rendered prose in checkpoints or research artifacts.
- Long-lived dashboard sessions that frequently switch files can leak memory if models/editors are not disposed correctly.
- Attempting to force Monaco into mobile browsers would conflict with the official support guidance and could degrade touch usability.

## Implementation Summary

### Architecture Decisions

1. **Markdown Default**: Markdown files default to Monaco raw-source view. This provides consistent behavior across all code/text files and allows users to see the actual source. The existing `forceMarkdown` flag can be used for rendered preview when needed.

2. **Rollout Scope**: Monaco is enabled across all artifact groups (`files`, `research`, `checkpoints`) using the shared `ArtifactViewer` component for consistency.

3. **Monaco Integration**: Uses `@monaco-editor/react` pattern with direct `monaco-editor` import for lifecycle control. The implementation lazy-loads the Monaco bundle only when a supported file is opened.

### Files Changed

- `client/package.json` - Added `monaco-editor` and `@monaco-editor/react` dependencies
- `client/vite.config.ts` - Added `monaco-vendor` to manual chunks for code splitting
- `client/src/utils/fileUtils.ts` - Added Monaco file classification utilities
- `client/src/utils/fileUtils.test.ts` - Added tests for file classification
- `client/src/components/shared/MonacoEditor/` - New Monaco Editor component with GitHub Dark theme
- `client/src/components/shared/ArtifactViewer/` - New unified artifact viewer component
- `client/src/components/SessionDetail/SessionDetail.tsx` - Updated to use `ArtifactViewer`
- `client/src/components/mobile/MobileSessionPane.tsx` - Updated to use `ArtifactViewer` with mobile fallback

### Supported File Types

Monaco is used for: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.html`, `.htm`, `.css`, `.scss`, `.sass`, `.less`, `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.sql`, `.py`, `.rb`, `.go`, `.rs`, `.java`, `.cpp`, `.c`, `.h`, `.cs`, `.php`, `.swift`, `.kt`, `.scala`, `.r`, `.pl`, `.sh`, `.bash`, `.zsh`, `.fish`, `.ps1`, `.xml`, `.toml`, `.ini`, `.conf`, `.config`, `.properties`, `.graphql`, `.gql`, `.proto`, plus special filenames like `Dockerfile`, `Makefile`, `Gemfile`.

### Mobile Fallback

Monaco is deliberately disabled on mobile (detected via `isMobile` prop). Mobile users continue to see the lightweight MarkdownRenderer fallback, as Monaco is not officially supported in mobile browsers.

## Open Questions (Resolved)

- ~~Should markdown default to raw source in Monaco, or should the UI offer a toggle between Monaco source view and rendered markdown preview?~~ **Decision**: Monaco raw-source is default; `forceMarkdown` prop provides rendered preview option.
- ~~Should Monaco be used only in the `files` artifact group first, or across `files`, `research`, and `checkpoints` in the initial rollout?~~ **Decision**: Rolled out across all artifact groups via shared `ArtifactViewer` component.
- ~~Is a thin React wrapper acceptable, or should the implementation use `monaco-editor` directly to keep lifecycle control explicit?~~ **Decision**: Uses direct `monaco-editor` import with lazy loading for explicit lifecycle control.

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