# How to Use Microsoft Dev Tunnels

> **Prefer Cloudflare Tunnel for new setups.** Dev Tunnels are a fallback — use them only when Cloudflare Tunnel and Tailscale are unavailable. See [How to Access the Dashboard Remotely](remote-access.md) for the full provider comparison.

This guide covers the Microsoft Dev Tunnels workflow for exposing the Copiloting Agents dashboard to remote devices.

## When to use Dev Tunnels

Use Dev Tunnels when:
- Cloudflare Tunnel is blocked or unavailable in your environment.
- Tailscale is not an option.
- You already have Dev Tunnels configured and working.

**Note:** The free tier has observed reliability issues including a ~5 GB/month bandwidth cap and 429 rate-limit errors.

---

## Before you start

- Node.js 18+ and npm are installed.
- You have a Microsoft, GitHub, or Entra account.

---

## Install and authenticate (one-time)

```bash
winget install Microsoft.devtunnel
devtunnel user login
```

`devtunnel user login` opens a browser to authenticate. Complete the sign-in flow, then return to the terminal.

---

## Expose the production server

### 1. Start the production server

```bash
npm start
```

The server must be running before the tunnel starts — the script preflights `http://127.0.0.1:3001/api/health`.

### 2. Start the tunnel in a second terminal

```bash
npm run tunnel:prod
```

The script:
1. Checks `http://127.0.0.1:3001/api/health` with retries.
2. Creates (or reuses) tunnel `copiloting-agents-prod`.
3. Creates (or reuses) port mapping for port 3001.
4. Runs `devtunnel host copiloting-agents-prod`.

The public tunnel URL is printed once the host is running.

### Custom port

If `npm start` auto-selected a different port (e.g., 3002):
```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:prod
```

---

## Expose the Vite dev server (not recommended for public sharing)

```bash
npm run dev          # start dev server on port 5173
npm run tunnel:client  # second terminal
```

The `tunnel:client` script creates or reuses tunnel `copiloting-agents-client` on port 5173.

---

## Fixed tunnel IDs

The repo uses fixed tunnel IDs so the same URL is reused across runs:

| Script | Tunnel ID | Port |
|--------|-----------|------|
| `npm run tunnel:prod` | `copiloting-agents-prod` | 3001 (or `PORT`) |
| `npm run tunnel:client` | `copiloting-agents-client` | 5173 |

### Override the tunnel ID

```bash
# Windows CMD
set DEVTUNNEL_TUNNEL_ID=myapp-prod && npm run tunnel:prod

# PowerShell
$Env:DEVTUNNEL_TUNNEL_ID = 'myapp-prod'; npm run tunnel:prod
```

---

## Known limitations

| Limitation | Details |
|------------|---------|
| Bandwidth cap | ~5 GB/month observed on the free tier |
| Rate limiting | 429 errors after excessive requests |
| Reliability | Service-side errors may occur independently of local app health |
| Account requirement | Microsoft, GitHub, or Entra authentication required |

---

## Troubleshooting

### "Rate limit exceeded. User Bandwidth Consumption: 5GB/M"

You've hit the monthly bandwidth cap. Switch to Cloudflare Tunnel and wait for the monthly reset:
```bash
npm run tunnel:cloudflare
```

### "Rate limit exceeded (429). Too many requests in a given amount of time."

The service is throttling your requests. Wait a few minutes and retry, or switch to an alternative provider.

### "ClientSSH: ... window is full"

This message may appear while the tunnel is active. It is generally safe to ignore as long as the tunnel remains operational.

### Preflight fails

The `tunnel:prod` script requires the production server to be running before it starts:

```bash
npm start             # start the server first
npm run tunnel:prod   # then start the tunnel in a second terminal
```

If `npm start` picked a different port because 3001 was busy:
```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:prod
```

---

## See also

- [How to Access the Dashboard Remotely](remote-access.md) — full provider comparison including Cloudflare Tunnel and Tailscale
- [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Tailscale Funnel documentation](https://tailscale.com/kb/1223/funnel)
