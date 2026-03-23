# About the Desktop Session UX Refresh

This note explains why the desktop dashboard now uses a denser session list and a split detail layout.

## Why the desktop UI changed

The mobile route introduced an overview-first way to scan sessions, but the desktop experience still spent too much width on empty space and too much height on the horizontal tab strip.

That made it harder to monitor multiple sessions quickly on large screens and on shorter desktop windows.

## What changed in the Session List

- Rows now surface session status, sub-agent count, project, branch, mode, model, last activity, duration, and agent or message summary directly in the default viewport.
- Grid cards use the same higher-value metadata and only show message previews when that preview adds context.
- Desktop list interactions now include clearer focus-visible states so keyboard navigation stays legible.

## What changed in Session Detail

- The top of the detail page is now a session overview panel with status, project and branch context, prompt summary, attention signals, and timing, todo, and sub-agent metrics.
- The thread switcher is now a vertical navigation rail instead of a horizontal tab strip.
- The rail keeps the first eight tabs visible and moves the rest into a `More threads` section so overflow stays discoverable.
- The selected tab controls the visible panel through explicit tab and tabpanel relationships, and arrow-key navigation moves through the rail in visual order.

## QA summary

- `npm run build` passed for the full workspace.
- Desktop list behavior was checked at `1920x1080`; the first rows showed status chips, project and branch context, last activity, duration, and agent or message summaries without extra scrolling.
- Desktop detail was checked at `1920x1080` and `2560x1440`; the overview panel and vertical tab rail remained visible and readable at both sizes.
- Keyboard navigation moved selection from `Main session` to `Plan` with `ArrowDown`, and the active `tabpanel` remained labelled by the selected tab.
- Overflow behavior was exercised on a live session with more than eight tabs; the `More threads` section expanded and exposed additional thread tabs.
- Mobile smoke checks on `/m` and `/m/sessions/:id` still rendered correctly after the first fetch completed. Direct mobile detail loads briefly show a spinner until the first fetch resolves, then the full view hydrates.
- No browser console errors were observed during QA.

## Further reading

- [About the Dashboard Architecture](how-it-works.md)
- [How to Access the Dashboard From Your Phone](../../how-to/dashboard/access-from-your-phone.md)
