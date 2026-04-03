---
date: 2026-04-03
type: Task
severity: Medium
status: Resolved
---

# Task: Redesign mobile session detail with an always-visible sticky summary bar

## Objective
Redesign the mobile session detail view so the user always has a compact, visually clear summary bar pinned to the top of the screen. The bar should remain visible while scrolling, survive any in-page navigation or content focus changes, and surface the session's essential state at a glance without creating visual noise.

The summary bar should emphasize key cues with vibrant but controlled color accents so the mobile view feels more readable and informative while staying calm and non-distracting overall.

## Tasks
- [x] Define the exact set of session fields that belong in the sticky summary bar, prioritizing only the information needed for instant orientation.
- [x] Rework the mobile session detail layout so the summary bar is always visible and remains sticky during scroll.
- [x] Add distinct color treatment for important cues such as session status, attention state, and current activity, while keeping the palette restrained.
- [x] Ensure the bar does not obscure content, break the scroll experience, or interfere with tapping/interaction in the session detail surface.
- [x] Review the layout across small mobile widths to confirm the bar remains legible and compact.
- [x] Update or add tests for the mobile detail layout and sticky header behavior if existing coverage is available.

## Acceptance Criteria
- [x] The mobile session detail view includes a visible summary bar that is present at the top of the screen throughout the session detail experience.
- [x] The summary bar stays sticky when the user scrolls through messages, artifacts, or other session content.
- [x] Essential session info is readable at a glance without needing to scroll back to the top.
- [x] Color accents communicate state clearly but do not create distraction or compete with the main content.
- [x] The redesign works cleanly on narrow mobile screens and does not block taps, scrolling, or navigation.
- [x] Any relevant tests or manual verification steps pass for the updated mobile layout.

## Resolution

Implemented in commits `22538d3` and `6a98953`.

### Summary of Changes

Created a new `StickySummaryBar` component in `MobileSessionPane.tsx` that:

1. **Sticky Positioning**: Uses `sticky top-0 z-20` with solid background (`bg-gh-surface`) for high contrast and excellent visibility

2. **Compact Summary Fields**:
   - State indicator dot with color coding (gh-attention, gh-active, emerald-400, red-400, gh-accent)
   - Session state label with uppercase styling
   - Live indicator for open sessions
   - Session title with line-clamp for long titles
   - Project name, git branch, and model context
   - Compact "Back" button when `showBackLinks` is enabled

3. **Essential Signals Row**:
   - Message count with icon
   - Duration (compact format: "1h 30m" or "45m")
   - Pending plan badge
   - Active agent count with pulse animation
   - In-progress todo count
   - Blocked todo count with attention color
   - Todo progress (done/total)

4. **Integrated Tab Navigation**: The tab bar is now part of the sticky header with a subtle top border separator, ensuring users can always switch between Overview, Activity, Work, and Agents sections without scrolling

5. **Color Accents**:
   - `gh-attention` (red): Needs attention, plan pending, blocked todos
   - `gh-active` (green): Working state, active agents, completed todos
   - `emerald-400`: Task complete
   - `red-400`: Aborted state
   - `gh-accent` (blue): In-progress todos, default/monitoring

6. **High Contrast Design**: Solid surface background (`bg-gh-surface`) with clear borders ensures the bar is clearly distinct from scrolling content below

## References
- [Mobile session detail component](client/src/components/mobile/MobileSessionDetail.tsx)
- [Mobile layout shell](client/src/components/mobile/MobileLayout.tsx)
- [Mobile session pane](client/src/components/mobile/MobileSessionPane.tsx)
- [Client architecture notes](AGENTS.md)
