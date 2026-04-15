# Copilot Sessions Dashboard

> **Real-time web UI for monitoring agentic coding sessions in the Copilot CLI** — track active agents, sub-agent orchestration, tool calls, plans, and todos from a single browser tab.

A local web dashboard for [Copilot CLI](https://github.com/github/copilot-cli) that gives you full visibility into what your AI coding agent is doing. Whether you're running multi-agent workflows, waiting for plan approval, or just checking whether a long task is still in progress — this dashboard surfaces it all without touching your terminal.

**Keywords:** agentic coding dashboard · Copilot CLI UI · AI coding agent monitor · multi-agent orchestration viewer · LLM agent task tracker · sub-agent workflow visualization · AI pair programming dashboard

## Quick start

```bash
npx copiloting-agents
```

Then open the URL shown in the terminal, usually **http://localhost:3001**. If port 3001 is already in use and you did not set `PORT`, the server automatically picks the next free port and prints it for you. No install, no config.

Desktop routes stay at `/` and `/sessions/:id`. The dedicated mobile namespace is available at `/m` and `/m/sessions/:id`.

<img width="1911" height="934" alt="Screenshot 2026-03-19 at 18 22 24" src="https://github.com/user-attachments/assets/b1d6a93a-8e06-4d98-940b-eece7f47574f" />

<img width="1911" height="932" alt="Screenshot 2026-03-19 at 18 21 45" src="https://github.com/user-attachments/assets/6ce86d56-bd4c-437c-9eb9-d8789d27b049" />

## Features

### Session monitoring
- **Live session list** — all active Copilot CLI sessions with real-time status badges
- **List / grid toggle** — switch between a compact table view and a bento-style card grid; choice persists across reloads
- **Desktop notifications** — browser push alert when any session needs your attention or completes a task, even with the tab in the background

**List view**
```
┌─────────────────────────────────────────────────┐
│ ● Search for Apigee gateway documentation       │  ← 🟡 needs attention
│   copiloting-agents · main · 23m · 2 msgs       │
│   [Plan review]                                 │
│   └ ≡ Read · explore-cmt-job-flow          Done │
│   └ ≡ Read · explore-cmt-entities-tests    Done │
├─────────────────────────────────────────────────┤
│ ● Implement REST client migration               │  ← 🟢 working
│   one-web · feature/rest-client · 41m · 3 msgs  │
│   [Working]  ≡ 1 sub-agent running             │
├─────────────────────────────────────────────────┤
│ ● Fix N+1 translation query performance         │  ← 🟢 task complete
│   one-api · main · 1h 12m · 4 msgs             │
│   [✓ Task complete]                             │
├─────────────────────────────────────────────────┤
│ ● Update notification stream service            │  ← ⚫ idle
│   one-web · main · 2h 30m · 7 msgs             │
│   [Idle]                                        │
├─────────────────────────────────────────────────┤
│ ● Scaffold K8s executor service                 │  ← 🔴 aborted
│   k8s-tools · feature/executor · 3h · 2 msgs   │
│   [Aborted]                                     │
└─────────────────────────────────────────────────┘
```

**Grid view** — each card shows a preview of the last message as a chat bubble, color-coded tool chips, and active sub-agent badges:
```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ Search for Apigee docs      │  │ Implement REST client        │
│ copiloting-agents · main    │  │ one-web · feature/rest · 41m │
│ · 23m · [Plan review]       │  │ · [Working]                  │
│─────────────────────────────│  │─────────────────────────────│
│ C  "Here is the evaluation  │  │ C  ┌─────────────────────┐  │
│    plan I've drafted…"      │  │    │ • bash  • edit ×3   │  │
│─────────────────────────────│  │    └─────────────────────┘  │
│ ≡ Read · explore-cmt   2m   │  │─────────────────────────────│
└─────────────────────────────┘  │ ● Explore   just now        │
                                  └─────────────────────────────┘
```

### Conversation & tool calls
- **Full message history** — complete conversation thread per session with timestamps
- **Syntax-highlighted tool calls** — collapsible blocks for `bash`, `edit`, `read`, `write`, `web_fetch` with inputs and outputs
- **Intent labels** — `report_intent` calls shown inline as readable action labels
- **Ask user blocks** — pending questions and chosen answers rendered with choice UI

### Sub-agent orchestration
- **Sub-agent tabs** — every spawned sub-agent (Explore, Read, task-based workers) gets its own message tab inside the session detail
- **Sub-agent status** — running agents pulse green; completed agents shown with a grey dot
- **Parallel agents** — multiple sub-agents from the same interaction are listed newest-first
- **Read agents** — `read_agent` tool calls tracked and surfaced as "Read · {agent-id}" tabs

### Plan mode
- **Plan tab** — view the full `plan.md` content with styled markdown (headings, checkboxes, code blocks, tables)
- **Needs attention detection** — session automatically flagged when `exit_plan_mode` is pending approval
- **Auto-focus** — dashboard switches to the Plan tab when a new plan is awaiting your approval
- **Approval banner** — amber notice with instructions when plan is pending

### Todo tracking
- **Todos tab** — live task list read from the agent's `session.db` SQLite database
- **Status groups** — tasks organised into In Progress, Blocked, Pending, and Done sections
- **Dependency display** — expandable rows show task description and upstream dependencies

### Zero cloud dependency
- Reads Copilot session-state directories directly from disk — on Windows it discovers both native and WSL-backed sessions automatically
- Polling every 5 seconds picks up new sessions and state changes automatically

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- Copilot CLI installed and has created at least one session in the detected session-state directory on Windows, Linux, or WSL

## Installation

```bash
# Clone the repo
git clone <repo-url>
cd copiloting-agents

# Install all dependencies (root + server + client workspaces)
npm install
```

## Starting the Dev Server

```bash
npm run dev
```

This starts both services concurrently:

| Service    | URL                   |
| ---------- | --------------------- |
| API server | http://localhost:3001 |
| Web client | http://localhost:5173 |

Open **http://localhost:5173** in your browser.

Desktop routes stay at `/` and `/sessions/:id`. The dedicated mobile namespace is available at `/m` and `/m/sessions/:id`.

## Access From Your Phone (Same Wi-Fi)

When your phone is on the same home Wi-Fi, you can access the dashboard directly without an internet tunnel.

1. Find your PC/laptop IP address:
   - Windows: `ipconfig` → `IPv4 Address` under Wi-Fi.
   - macOS/Linux: `ifconfig` or `ip addr show`.

2. Start the app with host binding to all interfaces:

```bash
# Vite local dev (recommended for this project)
HOST=0.0.0.0 PORT=5173 npm run dev

# or the API server in this repo
HOST=0.0.0.0 PORT=3001 npm run dev
```

3. On mobile browser, open:

- `http://<PC_IP>:5173` for the frontend
- `http://<PC_IP>:3001` for the API server (optional test)

4. If default ports are busy, pick another port and adjust both start command and URL.

5. Ensure local firewall allows the port (Windows Defender Firewall, etc.).

---

## Access From Your Phone (Remote / Public Tunnel)

When you are away from home or on a different network, use a tunnel to expose your local dashboard publicly. This section covers the recommended approaches.

### Option 1: Cloudflare Tunnel (Recommended)

Cloudflare Quick Tunnels are the simplest free option for ad hoc public sharing. The URL is random each time, which is fine for temporary access.

**Limitations:** Quick Tunnels are for development and testing. They have a cap on concurrent in-flight requests and do not support Server-Sent Events (SSE).

#### Install cloudflared (one-time)

```bash
# Windows (winget)
winget install --id Cloudflare.cloudflared

# macOS (Homebrew)
brew install cloudflared

# Linux
# See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

#### Start tunnel (production mode)

Expose only the production server publicly:

```bash
npm start
npm run tunnel:cloudflare
```

The command prints a public URL (e.g., `https://something.trycloudflare.com`). Open it from your phone.

If `npm start` selected a different port because 3001 was busy, pass the same `PORT` to the tunnel command:

```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:cloudflare
```

#### Named tunnel with stable hostname (optional upgrade)

If you want the same URL every time, create a named Cloudflare Tunnel:

1. Authenticate once:
   ```bash
   cloudflared tunnel login
   ```

2. Create and run a named tunnel:
   ```bash
   cloudflared tunnel create copiloting-agents
   cloudflared tunnel route dns copiloting-agents dashboard.yourdomain.com
   cloudflared tunnel run copiloting-agents
   ```

See [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/) for full setup.

### Option 2: Tailscale (Secondary)

Tailscale is ideal if you already use it for device-to-device access. It keeps traffic on your private tailnet.

```bash
# Install Tailscale, then enable Funnel
tailscale funnel --bg --https=443 3001
```

**Limitations:** Funnel has bandwidth limits (approximately 1 Gbps egress, subject to their terms) and requires a Tailscale account.

See [Tailscale Funnel docs](https://tailscale.com/kb/1223/funnel).

### Option 3: Microsoft Dev Tunnels (Fallback)

Dev Tunnels remain available if the other options do not work in your environment.

```bash
# Windows (winget)
winget install Microsoft.devtunnel
devtunnel user login

# Production mode
npm start
npm run tunnel:prod
```

**Limitations:** Free tier has bandwidth caps (observed failures at ~5GB/month) and rate limits that may cause 429 errors.

See [.docs/how-to/operations/devtunnel.md](.docs/how-to/operations/devtunnel.md) for fixed tunnel IDs and advanced usage.

## How It Works

The dashboard reads session state directly from the Copilot session-state directory on your machine — no Copilot API calls, no internet required. On Windows it automatically checks both the local Windows profile and any accessible WSL distributions. The client polls the API every 5 seconds to pick up new sessions and state changes.

If you want to override discovery, set `COPILOT_SESSION_STATE` to one or more session-state roots separated by your platform path delimiter.

### Session States

| State                 | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| 🟡 **Needs attention** | Waiting for your input — pending `ask_user` or plan approval |
| 🟢 **Working**         | Agent has an active turn in progress                         |
| 🟢 **Task complete**   | Last task finished successfully                              |
| ⚫ **Idle**            | Turn ended cleanly, waiting for your next message            |
| 🔴 **Aborted**         | Last action was cancelled and agent did not recover          |

### Session Detail & Sub-agent Orchestration

Each session opens into a tabbed detail view. When the agent spawns sub-agents (Explore, Read, or task workers), each gets its own tab with its own message thread:

```
 Main │ 📖 Plan ● │ ☑ Todos │ ≡ Read · explore-cmt-job-flow ● │ ≡ Read · explore-cmt-entities ●
──────┴───────────┴─────────┴──────────────────────────────────┴──────────────────────────────────

 ⚠ Waiting for your approval · Review the plan below and approve or reject it in your terminal

 # API Gateway Evaluation Plan
 ──────────────────────────────
 ## Steps
   [✓] Research Apigee X capabilities and pricing model
   [✓] Research AWS API Gateway v2 — HTTP API tier
   [ ] Research Kong Gateway (Orbit team's existing deployment)
   [ ] Produce comparison matrix with weighted scoring
   [ ] Provide final recommendation with migration path

 ## Constraints
   › Must support OAuth 2.0 / OIDC natively
   › Monthly budget ceiling: $3,000
   › Zero-downtime migration required
```

Sub-agents run in parallel and are listed newest-first. A pulsing dot marks agents still running; a grey dot marks completed ones.

### Browser Notifications

Click **Enable notifications** in the header to receive desktop notifications when a session transitions to "Needs attention" or "Task complete" — even when the tab is in the background.

> **macOS:** If notifications don't appear, check **System Settings → Notifications → [your browser]** and ensure it's set to Alerts or Banners.

## Running without cloning (npx)

If the package is published to npm, anyone can run it with no installation step:

```bash
npx copiloting-agents
```

This downloads the pre-built package and starts the server at **http://localhost:3001** by default. If port 3001 is already in use and `PORT` is unset, it automatically uses the next free port and prints the exact URL.

To use a different port:

```bash
PORT=8080 npx copiloting-agents
```

## Production mode (from source)

Run a single command after `npm install` — no `npm run dev`, no separate client server:

```bash
npm install   # one-time setup
npm start     # build + serve on http://localhost:3001 (or the next free port if 3001 is busy)
```

`npm start` compiles the TypeScript server, builds the Vite client, then launches Express which serves the built client as static files alongside the API. Everything runs on a single port. When `PORT` is unset and 3001 is already occupied, the server automatically selects the next free port and prints the chosen URL in the startup banner.

To make that production server reachable from your phone while you are away from your local network, run `npm run tunnel:cloudflare` in a second terminal after `npm start`. If you use a custom `PORT` or the default port was auto-shifted because 3001 was busy, run both commands with the same port value so the preflight check and tunnel target stay aligned.

### Manual build steps

If you want to build and start separately (e.g. in a container):

```bash
npm run build              # compiles server (tsc) + client (vite build)
node server/dist/index.js  # starts the server; client/dist/ is served automatically
```


## Project Structure

```
copiloting-agents/
├── server/          # Express API — reads detected Copilot session-state directories
├── client/          # React + Vite + Tailwind CSS dashboard
└── .docs/           # Diátaxis-organised documentation (see .docs/index.md)
```

See [AGENTS.md](AGENTS.md) for development conventions.
