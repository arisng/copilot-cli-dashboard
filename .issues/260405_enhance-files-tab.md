---
type: Feature Plan
title: Enhance the "Files" tab in session details view in desktop mode
description: Upgrade the "Files" tab to display a tree-like structure for better navigation.
status: Completed
author: GitHub Copilot
date: 2026-04-05
---

# Enhance the "Files" tab in session details view in desktop mode

## Goals
- Improve the user experience of navigating files within the session details view on desktop.
- Provide a hierarchical view of files and folders instead of a flat list.

## Requirements
- When clicking on the "Files" tab, the view should show a tree-like structure.
- The tree view must support collapse and uncollapse (expand) actions.
- Collapsing should fold all folders and sub-folders; uncollapsing should expand them.
- Each tree item should display minimal essential metadata (e.g., file name, size, type icon).
- Clicking on a tree item that is not a folder (i.e., a file) should open the content panel as it currently does.

## Implementation Approach
- Use a tree component (or build one) that supports rendering nested structures.
- Map the current flat file list into a hierarchical structure based on file paths.
- Add state management for the expanded/collapsed state of each folder node, and a global toggle for collapse all/uncollapse all.
- Integrate the existing file click handler to open the file content panel when a leaf node is clicked.

## Risks
- Performance issues if the file tree is very large.
- Maintaining the state of expanded folders when navigating away and back.
