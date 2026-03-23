# How to Run the Production Server

This guide shows how to build the dashboard and serve the compiled client and API from a single port.

## When to use this guide

Use this when you want the repository to run in production mode from source instead of the development stack.

## Before you start

- Dependencies are installed
- You are at the repository root

## Steps

1. Start the production server:

   ```bash
   npm start
   ```

2. Wait for the build to finish and for Express to start listening.

3. Open `http://localhost:3001` in your browser.

4. If you need a different port, set `PORT` before starting the server.

## Troubleshooting

**Problem: The server never starts**

Make sure the build step can complete and that nothing else is already listening on the selected port.

**Problem: The browser shows stale data**

The server reads the Copilot session-state files directly on each request, so stale data usually means the target session is no longer writing events.

## Next steps

- [How to Access the Dashboard From Your Phone](access-from-your-phone.md)
- [Commands Reference](../../reference/operations/commands.md)

