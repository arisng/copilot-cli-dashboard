# Microsoft Dev Tunnels (Fallback)

> **Status:** Fallback option. For new setups, we recommend [Cloudflare Tunnel](remote-access.md#cloudflare-tunnel-recommended) as the primary public-sharing solution.

This document covers the Microsoft Dev Tunnels workflow for remote access to the Copiloting Agents dashboard.

## When to use Dev Tunnels

Use Dev Tunnels only when:
- Cloudflare Tunnel is unavailable or blocked in your environment
- Tailscale is not an option
- You already have Dev Tunnels configured and working

**Note:** The free tier of Dev Tunnels has observed reliability issues including bandwidth caps (~5 GB/month) and rate limiting (429 errors). See [Remote Access Guide](remote-access.md) for the recommended alternatives.

---

## Quick start

### Install devtunnel (one-time)

```bash
winget install Microsoft.devtunnel
devtunnel user login
```

### Production mode (recommended)

Expose the production server on port 3001:

```bash
npm start
npm run tunnel:prod
```

### Dev mode (not recommended for public sharing)

Expose the Vite dev server on port 5173:

```bash
npm run dev
npm run tunnel:client
```

---

## Fixed tunnel IDs

To avoid random temp URLs, this repo uses fixed tunnel IDs:

| Script | Tunnel ID | Port |
|--------|-----------|------|
| `npm run tunnel:client` | `copiloting-agents-client` | 5173 |
| `npm run tunnel:prod` | `copiloting-agents-prod` | 3001 (or PORT) |

### Override the tunnel ID

```bash
# Windows CMD
set DEVTUNNEL_TUNNEL_ID=myapp-prod && npm run tunnel:prod

# PowerShell
$Env:DEVTUNNEL_TUNNEL_ID = 'myapp-prod'; npm run tunnel:prod
```

---

## How the scripts work

### tunnel-prod.js workflow

1. **Preflight**: Checks `http://127.0.0.1:3001/api/health` with retries
2. **Create tunnel**: `devtunnel create copiloting-agents-prod` (tolerates existing)
3. **Create port**: `devtunnel port create copiloting-agents-prod -p 3001` (tolerates existing)
4. **Host**: `devtunnel host copiloting-agents-prod`

### tunnel-client.js workflow

1. **Create tunnel**: `devtunnel create copiloting-agents-client` (tolerates existing)
2. **Create port**: `devtunnel port create copiloting-agents-client -p 5173` (tolerates existing)
3. **Host**: `devtunnel host copiloting-agents-client`

---

## Known limitations

| Limitation | Details |
|------------|---------|
| Bandwidth cap | ~5 GB/month observed |
| Rate limiting | 429 errors after excessive requests |
| Reliability | Service-side errors may occur independently of local app health |
| Account requirement | Microsoft, GitHub, or Entra authentication required |

---

## Troubleshooting

### "Rate limit exceeded. User Bandwidth Consumption: 5GB/M"

You've hit the free tier bandwidth cap. Switch to [Cloudflare Tunnel](remote-access.md#cloudflare-tunnel-recommended) or wait for the monthly reset.

### "Rate limit exceeded (429). Too many requests in a given amount of time."

The service is temporarily throttling your requests. Wait a few minutes and retry, or switch to an alternative provider.

### "ClientSSH: ... window is full"

This message may appear while the tunnel is active. It is generally acceptable as long as the tunnel remains operational.

### Preflight fails

The `tunnel:prod` script requires the production server to be running:

```bash
npm start        # Start server first
npm run tunnel:prod   # Then start tunnel in another terminal
```

If `npm start` selected a different port because 3001 was busy, use the same `PORT`:

```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:prod
```

---

## See also

- [Remote Access Guide](remote-access.md) — primary documentation with Cloudflare Tunnel and Tailscale
- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/funnel)
