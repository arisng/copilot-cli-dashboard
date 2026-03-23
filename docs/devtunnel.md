# DevTunnel fixed tunnel-id workflow

## Background

This repo uses Microsoft Dev Tunnels CLI (`devtunnel`) for remote mobile access during development.

Originally scripts used `devtunnel host --subdomain <name>` and/or `devtunnel host <name> -p <port>`, but the installed CLI version rejects the first option and for the second version it requires the tunnel to exist with individual port records.

## Fix implemented

- Added a dedicated script for production tunnel: `bin/tunnel-prod.js`
- Added a dedicated script for client tunnel: `bin/tunnel-client.js`

### workflow

1. Preflight the configured production server port on `http://127.0.0.1:<PORT>/api/health` (defaults to 3001) with retry.
2. Create or reuse tunnel ID: `copiloting-agents-prod` (or `DEVTUNNEL_TUNNEL_ID` override).
3. Create or reuse port mapping: `devtunnel port create <tunnelId> -p <PORT>`.
4. Host tunnel: `devtunnel host <tunnelId>`.

Client script uses `copiloting-agents-client` and port 5173.

## `package.json` updates

- `tunnel:client`: `node ./bin/tunnel-client.js`
- `tunnel:prod`: `node ./bin/tunnel-prod.js`

## Existing script updates

- `bin/tunnel-prod.js`: preflight retry, port create step, and host with tunnel ID.
- `bin/tunnel-client.js`: new script with create+port+host.

## Notes

- If a tunnel or port already exists, command status 1 is tolerated and workflow continues.
- If `npm start` auto-selected a different port because 3001 was busy, set `PORT` explicitly before running the tunnel so the preflight and tunnel mapping stay aligned.
- The devtunnel service status may show `ClientSSH: ... window is full` while active; this is acceptable as long as the tunnel is up.
