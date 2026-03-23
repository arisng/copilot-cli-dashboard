# Commands Reference

This page lists the primary commands exposed by the repository.

## Local development

- `npm install` — install the root, server, and client dependencies
- `npm run dev` — start the API server on port 3001 and the client on port 5173 together
- `npm run build` — build the server and client for production

## Running from npm

- `npx copiloting-agents` — download and run the published package on port 3001
- `PORT=8080 npx copiloting-agents` — run the published package on a custom port

## Production hosting

- `npm start` — build and serve the compiled app from a single port
- `PORT=8080 npm start` — serve production output on a custom port
- `npm run tunnel:prod` — expose the production server through Dev Tunnels after the server is already listening

## Remote access

- `npm run tunnel:client` — expose the Vite client through Dev Tunnels in development mode

## Related guides

- [Getting Started with Copilot Sessions Dashboard](../../tutorials/dashboard/getting-started.md)
- [How to Run the Production Server](../../how-to/dashboard/run-the-production-server.md)

