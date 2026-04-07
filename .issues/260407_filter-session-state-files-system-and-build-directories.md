---
title: "Filter system and build directories from session-state file browser"
type: "Task"
status: "Closed"
author: "Copilot"
created: "2026-04-07"
priority: "High"
description: "Enforce filtering rules in the session-state files browser so heavy or user-unhelpful directories such as node_modules, bin, and similar generated folders are hidden from view."
---

# Filter system and build directories from session-state file browser

## Summary

The `~/.copilot/session-state/<session-id>/files/` area can contain full application trees, including large dependency, build, and output directories. The file browser should hide those directories by default so the UI stays usable and only shows content that is relevant to end users.

## Problem Statement

- The session-state files folder may host a full Node-based web app, a .NET web app, or other framework-specific projects.
- Large generated directories such as `node_modules`, `bin`, and similar build artifacts are expensive to enumerate and add noise to the file browser.
- Showing those folders creates a poor user experience because they are rarely useful for inspection in this context.

## Goals

1. Hide heavyweight dependency and build directories from the file browser by default.
2. Keep the filter rules scoped to the session-state files view so the underlying filesystem remains unchanged.
3. Preserve access to user-authored source files and other relevant project content.
4. Make the filtering rules easy to extend if other generated directories need to be excluded later.

## Requirements

- The files browser should not display `node_modules` directories.
- The files browser should not display `bin` directories.
- The filter should also cover similar generated or output directories where appropriate, such as common dependency, build, and cache folders.
- Filtering should apply consistently across nested directories, not just at the top level.
- Source and configuration files that users are likely to inspect must remain visible.
- The behavior should be implemented as a presentation-layer filter, not by deleting or mutating the session-state files on disk.

## Acceptance Criteria

- `node_modules` does not appear in the session-state files browser.
- `bin` does not appear in the session-state files browser.
- Other excluded build or dependency directories are hidden consistently.
- Normal source files and useful project folders still appear.
- The filtering behavior is documented or discoverable enough for future maintenance.

## References

- Session files root: `~/.copilot/session-state/<session-id>/files/`
- Relevant user request: filter heavy and unhelpful folders from the session-state files browser.