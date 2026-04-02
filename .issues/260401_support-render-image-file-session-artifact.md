---
title: "Support rendering image files as session artifacts in the 'files' folder"
type: "Feature"
status: "Completed"
author: "Copilot"
created: "2026-04-01"
completed: "2026-04-02"
priority: "Medium"
---

## Summary

Enable viewing image files (e.g., `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) inside Copilot session artifacts for the `files` folder in Session Detail. The feature should display image thumbnails/previews directly within the UI when a user selects an image artifact path.

## Problem Statement

- Session artifact support currently surfaces text and code artifacts, but image artifacts in `files/` are not rendered as inline previews.
- Users storing screenshots, diagrams, or visual debug outputs in `files/` cannot quickly inspect them without downloading and opening externally.
- The missing image preview workflow reduces productivity and makes artifact review cumbersome.

## Goals

1. In Session Detail (desktop and mobile if supported), the `files` artifact panel should detect image MIME types and render preview thumbnails.
2. Clicking an image artifact should open an inline lightbox/viewer or embedded image element rather than downloading only.
3. Keep existing non-image file handling unchanged (text artifacts remain in code viewer mode, binary downloads still available where applicable).

## Requirements

- [x] Update the artifact file browser component (likely in `client/src/components/SessionDetail/SessionDetail.tsx`, `SessionMeta.tsx`, `SessionDetail` hooks, or `client/src/components/SessionList/` depending on existing architecture) to detect and categorize image files by extension or MIME type.
- [x] Add an `ImagePreview` subcomponent to render selected image artifacts safely with `img` element, proper `alt`, `max-width` constraints, and error fallback.
- [x] Add a fallback for unsupported image assets (corrupt file, unsupported format) with a friendly message and download button.
- [x] Ensure path safety and security: only render images from permitted artifact paths (`files/` scoped), avoid unescaped filesystem URL injection.
- [ ] Add tests at `client/src/components/SessionDetail/__tests__` or equivalent for new image artifact rendering and selection behavior.
- [x] Add documentation note in `docs/client.md` or `docs/session-model.md` describing supported artifact types and behavior in the UI.

## Acceptance Criteria

- [x] In a session with a `files/` image artifact, the UI shows image artifacts as preview-capable items.
- [x] Selecting an image artifact displays the image in the artifact viewer panel (embedded, not forcing a file download).
- [x] Non-image files continue to render existing behavior and are unaffected.
- [x] Error handling for invalid image artifacts provides a clear message and download option.
- [ ] Unit/integration tests cover image preview and fallback conditions.

## Notes

- This issue is scoped to UI rendering in existing session artifact browsing UI; backend file indexing may already exist and should be reused.
- If a lightweight image carousel is feasible, it may be considered as a follow-up improvement, but MVP is single-image inline preview.
