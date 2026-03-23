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

- The left column now focuses on the session overview panel with status, project and branch context, prompt summary, attention signals, and timing, todo, and sub-agent metrics.
- The overview callout now stacks below the main summary at desktop widths so the first column stays responsive instead of collapsing under a centered max-width shell.
- The middle column keeps the vertical thread switcher and the active tab detail together in a two-pane subgrid so the selected content stays in the same viewport region.
- The rail keeps the first eight tabs visible and moves the rest into a `More threads` section so overflow stays discoverable.
- The selected tab controls the visible panel through explicit tab and tabpanel relationships, and arrow-key navigation moves through the rail in visual order.

## QA summary

- `npm run build` passed for the full workspace.
- Desktop list behavior was checked at `1920x1080`; the first rows showed status chips, project and branch context, last activity, duration, and agent or message summaries without extra scrolling.
- Desktop detail was checked at `1440x1080` and `2560x1440`; the overview panel and middle-column tab rail/detail split remained visible and readable at both sizes.
- Keyboard navigation moved selection from `Main session` to `Plan` with `ArrowDown`, and the active `tabpanel` remained labelled by the selected tab.
- Overflow behavior was exercised on a live session with more than eight tabs; the `More threads` section expanded and exposed additional thread tabs.
- Mobile smoke checks on `/m` and `/m/sessions/:id` still rendered correctly after the first fetch completed. Direct mobile detail loads briefly show a spinner until the first fetch resolves, then the full view hydrates.
- No browser console errors were observed during QA.
- The follow-up three-column viewport pass confirmed that the desktop detail page stayed inside the viewport at `1440x1080` and `2560x1440` (`scrollHeight === innerHeight` and `scrollY === 0`) while the shared browse controls surfaced the `Working` status.
- Playwright screenshots for the follow-up were persisted under `.playwright-cli/screenshots/three-column-layout/`.

## Three-column viewport layout

The latest desktop follow-up keeps the session detail route inside the browser viewport and splits the available width into three independently useful regions:

- **Column 1** combines the session overview and summary metrics so title, status, prompt summary, attention state, and timing stay immediately visible. On narrower desktop widths the callout stacks below the content to keep the column responsive.
- **Column 2** holds the vertical tab rail and the active tab detail pane for the main session thread, plan, todos, and sub-agent conversations. It remains keyboard navigable and keeps overflow discoverable in a `More` section when needed.
- **Column 3** shows the project-scoped session browser with the same project, branch, status, and sort controls used elsewhere in the app.
- The shared session browse model now includes a `Working` status so desktop and mobile filters describe active sessions consistently.

### Evidence

![Desktop list filtered to Working sessions](../../../.playwright-cli/screenshots/three-column-layout/list-working-filter.png)

![Desktop detail at 1440x1080](../../../.playwright-cli/screenshots/three-column-layout/detail-three-column-1440.png)

![Desktop detail at 2560x1440](../../../.playwright-cli/screenshots/three-column-layout/detail-three-column-2560.png)

![Desktop detail with Working filter selected](../../../.playwright-cli/screenshots/three-column-layout/detail-working-filter.png)

## Further reading

- [About the Dashboard Architecture](how-it-works.md)
- [How to Access the Dashboard From Your Phone](../../how-to/dashboard/access-from-your-phone.md)
