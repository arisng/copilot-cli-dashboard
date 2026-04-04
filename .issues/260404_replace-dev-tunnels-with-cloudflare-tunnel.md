---
title: "Replace Microsoft Dev Tunnels with Cloudflare Tunnel for free remote dashboard access"
type: "RFC"
status: "Resolved"
author: "Copilot"
created: "2026-04-04"
priority: "High"
---

## Summary

Replace the current Microsoft Dev Tunnels workflow used for remote phone access with a Cloudflare Tunnel based workflow that is more reliable on the free tier and simpler for this repo's needs.

The application should expose only the production Express server on port `3001` when public tunneling is needed. Publicly tunneling the Vite dev server adds extra branching in the docs and setup without enough value for the default workflow. The current Dev Tunnels setup is failing due to service-side rate limiting and bandwidth quota enforcement, which makes it a weak default for ad hoc remote use.

## Problem Statement

- The current documented remote-access workflow depends on Microsoft Dev Tunnels for both dev and production sharing.
- A recent production tunnel attempt failed with service-side errors including:
  - `Rate limit exceeded. User Bandwidth Consumption: 5GB/M`
  - `Rate limit exceeded (429). Too many requests in a given amount of time.`
- These failures occur even when the local production server is healthy and the tunnel scripts tolerate expected idempotency errors such as existing tunnel IDs or ports.
- The repo currently presents Dev Tunnels as the primary remote-access recommendation in the README, which can send users toward a fragile default.
- For this project, remote access is a convenience workflow, not a core product feature, so the chosen tunnel solution should minimize account friction, hidden quotas, and operational surprises.

## Goals

1. Provide a free remote-access workflow that is more dependable than Microsoft Dev Tunnels for casual dashboard sharing.
2. Preserve the current mental model of exposing one local production port with a single command.
3. Keep same-network access as the simplest zero-dependency option when the phone and laptop are on the same Wi-Fi.
4. Make Cloudflare Tunnel the primary documented public-tunnel option.
5. Keep Tailscale as the secondary option and Dev Tunnels as the last fallback option.
6. Clearly document rate limits and practical constraints across all supported remote-access solutions.
7. Minimize code and maintenance overhead in this repository.

## Non-Goals

- Building a first-party relay or proxy service.
- Supporting every tunnel provider equally.
- Introducing a production-grade hosted deployment workflow.

## Current State

- `README.md` documents Dev Tunnels for remote phone access in both dev and production modes.
- `package.json` exposes `tunnel:client` and `tunnel:prod` scripts.
- `bin/tunnel-client.js` and `bin/tunnel-prod.js` are hard-wired to the `devtunnel` CLI.
- `docs/devtunnel.md` documents the fixed tunnel ID workflow and its current script behavior.
- The existing docs do not yet position Cloudflare, Tailscale, and Dev Tunnels in a clear primary-secondary-fallback order.
- The existing docs do not clearly compare service limits, such as bandwidth caps, in-flight request limits, or other public-sharing constraints.

## Options Considered

### Option A: Keep Microsoft Dev Tunnels

Pros:
- Already integrated into the repo.
- Stable fixed tunnel ID workflow already exists.

Cons:
- Observed free-tier rate limiting and bandwidth quota failures make it unreliable for this repo's sharing workflow.
- Requires Microsoft Dev Tunnel specific setup and authentication.
- User experience degrades into service errors even when local app health is fine.

### Option B: Switch default public sharing to Cloudflare Tunnel

Pros:
- Designed for exposing local HTTP services through an outbound-only tunnel.
- Works well for the repo's single production-port use case.
- Quick Tunnel flow is a single command with low setup overhead.
- Avoids the specific Dev Tunnels quota behavior that is currently blocking use.
- A random public URL is acceptable for the current use case.

Cons:
- Quick Tunnel URLs are random and change between runs.
- Quick Tunnels are intended for testing and development, not production hosting.
- Quick Tunnels have limitations, including a cap on concurrent in-flight requests and no SSE support.
- A stable hostname requires a Cloudflare account and preferably a domain.

### Option C: Recommend Tailscale Funnel

Pros:
- Good fit for private access across a user's own devices.
- Strong security model and device-to-device workflows.
- Reasonable secondary option for users who already use Tailscale.

Cons:
- Public sharing depends on Funnel, which has its own non-configurable bandwidth limits.
- Requires more account and network setup than Cloudflare Quick Tunnels.
- Less suitable than Cloudflare as the repo's simplest default public-sharing instruction.

### Option D: Recommend ngrok free tier

Pros:
- Familiar developer workflow.
- Good documentation and tooling.

Cons:
- Free plan limits are tighter than desirable for this use case, including low request and transfer caps.
- Free plan behavior is less attractive than Cloudflare for repeated dashboard viewing.

## Preferred Solution Order

1. Cloudflare Tunnel as the primary public-sharing solution.
2. Tailscale as the secondary solution.
3. Microsoft Dev Tunnels as the last fallback solution.

## Recommendation

Adopt Cloudflare Tunnel as the recommended free remote-access workflow.

Preferred rollout shape:

- Keep same-Wi-Fi LAN access as the first recommendation for users on the same network.
- Replace Dev Tunnels as the default public remote-access path in the README.
- Expose only the production server publicly in the recommended public workflow:
  - production server: `cloudflared tunnel --url http://localhost:3001`
- Keep Quick Tunnel as the default Cloudflare path for now because a random public URL is acceptable.
- Include a guideline for upgrading to a named Cloudflare Tunnel with a stable hostname.
- Keep Tailscale as a documented secondary path.
- Keep Dev Tunnels as a documented last fallback path rather than removing it outright.
- Add explicit rate-limit and service-limit notes for Cloudflare, Tailscale, and Dev Tunnels.

## Proposed Changes

- Update `README.md` remote access guidance to prioritize:
  - same-network LAN access
  - Cloudflare Tunnel for public remote access
  - Tailscale as the secondary option
  - Dev Tunnels as the last-resort fallback
- Narrow public-tunnel documentation to the production server on port `3001` and remove the public-dev-server recommendation from the primary path.
- Add a new documentation page for Cloudflare Tunnel usage, or replace `docs/devtunnel.md` with a provider-agnostic remote-access document.
- Add helper scripts such as:
  - `tunnel:cloudflare:prod`
- Add guidance for named Cloudflare Tunnel setup with a stable hostname as a nice-to-have upgrade path.
- Add a comparison section or matrix documenting practical limits across:
  - Cloudflare Quick Tunnel
  - Tailscale Funnel
  - Microsoft Dev Tunnels
- Keep the current Dev Tunnels scripts and docs, but reposition them as the last fallback rather than the primary recommendation.

## Requirements

- [ ] Document same-network LAN access as the simplest path when the phone and laptop are on the same network.
- [ ] Document Cloudflare Tunnel as the recommended primary free public-sharing workflow.
- [ ] Document Tailscale as the secondary remote-access solution.
- [ ] Document Microsoft Dev Tunnels as the final fallback solution.
- [ ] Provide Windows-friendly installation guidance for `cloudflared`.
- [ ] Provide command examples for production mode only in the public-tunnel guidance.
- [ ] State clearly that only the production server should be exposed publicly in the recommended workflow.
- [ ] Explain that a random Quick Tunnel URL is acceptable for now.
- [ ] Include a guideline for setting up a named Cloudflare Tunnel with a stable hostname.
- [ ] Document Quick Tunnel limitations clearly enough that users understand it is for development and ad hoc sharing.
- [ ] Clearly document rate limits and practical limits across Cloudflare, Tailscale, and Dev Tunnels.
- [ ] Keep and document the existing Dev Tunnels scripts and docs as fallback material.
- [ ] Avoid breaking the current local dev and production startup commands.

## Acceptance Criteria

- [ ] A new user can follow the README and expose `localhost:3001` publicly without using Microsoft Dev Tunnels.
- [ ] The README presents Cloudflare Tunnel as the primary free remote-access recommendation.
- [ ] The README presents Tailscale as the secondary option.
- [ ] The README presents Dev Tunnels as the last fallback option.
- [ ] The repo includes copy-pasteable Windows commands for installing and using `cloudflared`.
- [ ] Users on the same Wi-Fi still have a documented no-tunnel path.
- [ ] The docs clearly distinguish between Quick Tunnel ad hoc sharing and named Cloudflare Tunnel stable-hostname setups.
- [ ] The docs explicitly steer users away from publicly tunneling the dev server as the default workflow.
- [ ] The docs include clear rate-limit and constraint notes for Cloudflare, Tailscale, and Dev Tunnels.
- [ ] The final documentation avoids implying that the app itself depends on Dev Tunnels.

## Open Questions

- Should the repo add a dedicated `tunnel:cloudflare:prod` script, or keep Cloudflare usage as a documented manual command only?
- Should the named Cloudflare Tunnel guidance stay lightweight in the README and move detailed setup steps into a dedicated doc?

## Risks

- Cloudflare Quick Tunnels are still a third-party free service and may have their own development-focused limitations.
- If the app later depends on SSE or other long-lived connection patterns through the public tunnel, Quick Tunnel limitations may become more significant.
- Supporting multiple providers in docs can create drift if the repo does not choose one clear default.

## References

- `README.md`
- `package.json`
- `bin/tunnel-client.js`
- `bin/tunnel-prod.js`
- `docs/devtunnel.md`
- Terminal output from `npm run tunnel:prod` on 2026-04-04 showing Dev Tunnels rate-limit and bandwidth-cap errors