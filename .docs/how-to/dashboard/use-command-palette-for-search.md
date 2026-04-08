---
description: How to search across all session research files using the keyboard-driven command palette.
---

# Use the Command Palette for Global Search

The Copilot Sessions Dashboard includes a keyboard-driven command palette that lets you search across research files from all sessions without navigating session by session.

## Open the command palette

Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS) from anywhere in the dashboard.

The palette opens as a centered modal overlay with a search input and a list of results.

## Search for research files

1. Type your search query in the input field.
2. Results appear as you type (debounced by 300ms).
3. The search matches both file names and file contents (for `.md` and `.txt` files).

Each result shows:

- **Session name** — the session that contains the file
- **File name** — the research file name
- **Snippet** — a content excerpt showing the match context
- **Last modified** — relative time (e.g., "2h ago")

## Navigate results

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection up/down |
| `Enter` | Open the selected file |
| `Escape` | Close the palette |

## Open a file

Press `Enter` on a selected result to navigate to that session's **Artifacts** tab with the research file selected.

## View recent files

When the search query is empty, the palette displays the **10 most recently modified** research files across all sessions. This is useful for quickly accessing files you were recently working with.

## Close the palette

Press `Escape` or click the backdrop overlay to close the palette and return focus to the previously focused element.

## Mobile usage

On mobile devices, the command palette is not accessible via keyboard shortcut. Use the session list and navigate to individual session artifacts instead.
