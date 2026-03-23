# Getting Started with Copilot Sessions Dashboard

Learn how to install the repository, start the local dashboard, and view active Copilot CLI sessions in your browser.

## What you'll build

A local dashboard that reads Copilot session-state data and shows session history, tool calls, and status changes.

## Before you start

- Node.js 20+
- npm 10+
- Copilot CLI has created at least one session in `~/.copilot/session-state/`

## Step 1: Install dependencies

From the repository root, install the workspace dependencies:

```bash
npm install
```

You should end up with both the server and client workspaces ready to run.

## Step 2: Start the development environment

Run both the API server and the web client:

```bash
npm run dev
```

The API listens on `http://localhost:3001` and the client on `http://localhost:5173`.

## Step 3: Open the dashboard

Open `http://localhost:5173` in your browser.

You should see the live session list update every few seconds as Copilot CLI writes new session events.

## What you've learned

- How to install the project dependencies
- How to start the dashboard locally
- Where the web client and API are served

## Next steps

- [How to Run the Production Server](../../how-to/dashboard/run-the-production-server.md)
- [How to Access the Dashboard From Your Phone](../../how-to/dashboard/access-from-your-phone.md)
- [About the Dashboard Architecture](../../explanation/dashboard/how-it-works.md)

