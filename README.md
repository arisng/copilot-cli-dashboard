# Copilot Sessions Dashboard

A local web dashboard for monitoring your [Copilot CLI](https://github.com/github/copilot-cli) sessions in real time. Displays active sessions, message history, tool call details, and fires browser notifications when a session needs your attention or completes a task.

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- Copilot CLI installed and has created at least one session under `~/.copilot/session-state/`

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

| Service | URL |
|---------|-----|
| API server | http://localhost:3001 |
| Web client | http://localhost:5173 |

Open **http://localhost:5173** in your browser.

## How It Works

The dashboard reads session state directly from `~/.copilot/session-state/` on your machine — no Copilot API calls, no internet required. The client polls the API every 5 seconds to pick up new sessions and state changes.

### Session States

| Badge | Meaning |
|-------|---------|
| 🟡 **Needs attention** | Agent is waiting for your input (pending tool execution) |
| 🟢 **Working** | Agent is actively processing |
| 🟢 **Task complete** | Agent finished the last task |
| ⚫ **Idle** | Turn ended, waiting for your next message |
| ⚫ **Aborted** | Last action was cancelled |

### Browser Notifications

Click **Enable notifications** in the header to receive desktop notifications when a session transitions to "Needs attention" or "Task complete" — even when the tab is in the background.

> **macOS:** If notifications don't appear, check **System Settings → Notifications → [your browser]** and ensure it's set to Alerts or Banners.

## Production Build

```bash
# Build both server and client
npm run build

# Start the compiled server
npm run start --workspace=server
```

Serve the built client (`client/dist/`) with any static file server or point your web server at it.

## Project Structure

```
copiloting-agents/
├── server/          # Express API — reads ~/.copilot/session-state/
├── client/          # React + Vite + Tailwind CSS dashboard
└── docs/            # Architecture docs
    ├── client.md
    ├── server.md
    └── session-model.md
```

See [AGENTS.md](AGENTS.md) for development conventions.
