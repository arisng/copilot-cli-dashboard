# How to Access the Dashboard Remotely

Expose the Copiloting Agents dashboard to another device — phone, tablet, or a remote computer — using the access method that fits your situation.

## Before you start

- The dashboard can be started with `npm start` (production) or `npm run dev` (dev mode).
- Choose your access method based on your network setup:

| Method | Best for | Account required |
|--------|----------|-----------------|
| [Same Wi-Fi (LAN)](#same-wi-fi-lan) | Phone on home network | No |
| [Cloudflare Tunnel](#cloudflare-tunnel-recommended) | Quick public sharing | No |
| [Tailscale](#tailscale) | Private device mesh | Yes |
| [Microsoft Dev Tunnels](#microsoft-dev-tunnels-fallback) | Fallback only | Yes |

---

## Same Wi-Fi (LAN)

When your phone and your development machine are on the same Wi-Fi network, direct LAN access is the simplest option — no external services involved.

### 1. Find your machine's IP address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
```

**macOS / Linux:**
```bash
ifconfig
# or
ip addr show
```

### 2. Start the server bound to all interfaces

```bash
HOST=0.0.0.0 npm start
```

For the Vite dev server instead:
```bash
HOST=0.0.0.0 npm run dev
```

### 3. Open from your phone

```
http://<PC_IP>:3001
```

Use port `5173` when running the Vite dev server.

### Firewall

If the page doesn't load, allow inbound traffic on the chosen port through Windows Defender Firewall or your system firewall.

---

## Cloudflare Tunnel (Recommended)

Cloudflare Quick Tunnels expose your local server through Cloudflare's edge network. No account needed for a one-off public URL.

### 1. Install cloudflared (one-time)

```bash
winget install --id Cloudflare.cloudflared
```

### 2. Start the production server

```bash
npm start
```

### 3. Start the tunnel in a second terminal

```bash
npm run tunnel:cloudflare
```

The script checks `http://localhost:3001/api/health`, then launches:
```
cloudflared tunnel --url http://localhost:3001
```

A public URL like `https://random-string.trycloudflare.com` is printed. Open it on any device.

### Custom port

If `npm start` auto-selected a different port (e.g., 3002):
```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:cloudflare
```

### Named tunnel with stable hostname (optional)

Quick Tunnels generate a new random URL each run. For a persistent hostname:

1. Authenticate:
   ```bash
   cloudflared tunnel login
   ```
2. Create a named tunnel:
   ```bash
   cloudflared tunnel create copiloting-agents
   ```
3. Route a DNS record:
   ```bash
   cloudflared tunnel route dns copiloting-agents dashboard.yourdomain.com
   ```
4. Run it:
   ```bash
   cloudflared tunnel run copiloting-agents
   ```

See [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/) for full details.

### Limitations

| Limit | Notes |
|-------|-------|
| URL stability | Random per run — use named tunnels for stable URLs |
| SSE support | Server-Sent Events do **not** work through Quick Tunnels |
| Intended use | Development and ad-hoc sharing; not production hosting |

---

## Tailscale

Tailscale is ideal if your devices are already on a private tailnet, or if you want to use Tailscale Funnel for a publicly reachable URL.

### 1. Install and authenticate

```bash
tailscale up
```

### 2. Start the production server

```bash
npm start
```

### 3. Expose via Funnel

```bash
tailscale funnel --bg --https=443 3001
```

Tailscale Funnel makes the service reachable at your device's stable `*.ts.net` hostname.

### Limitations

| Limit | Notes |
|-------|-------|
| Account required | Must be logged into your tailnet |
| Funnel availability | Check your Tailscale plan — Funnel is not on all tiers |
| Egress | Subject to Tailscale terms; generous in practice |

See [Tailscale Funnel documentation](https://tailscale.com/kb/1223/funnel).

---

## Microsoft Dev Tunnels (Fallback)

Use Dev Tunnels only when Cloudflare Tunnel and Tailscale are not available. The free tier has a ~5 GB/month bandwidth cap and common 429 rate-limit errors.

For full setup and troubleshooting steps, see **[How to Use Microsoft Dev Tunnels](devtunnel.md)**.

### Quick start

```bash
winget install Microsoft.devtunnel
devtunnel user login

npm start
npm run tunnel:prod   # second terminal
```

---

## Provider comparison

| Feature | Cloudflare Quick Tunnel | Tailscale Funnel | Microsoft Dev Tunnels |
|---------|------------------------|------------------|-----------------------|
| Account required | No | Yes | Yes |
| URL stability | Random per run | Stable (`*.ts.net`) | Fixed with tunnel ID |
| SSE support | No | Yes | Yes |
| Bandwidth cap | Generous (dev use) | ~1 Gbps | ~5 GB/month |
| Rate limiting | Minimal | Minimal | 429 errors common |
| Private mesh | No | Yes (tailnet) | No |
| Best for | Quick public sharing | Private device mesh | Fallback only |

---

## Security notes

- **LAN**: Most private — traffic never leaves your local network.
- **Cloudflare Tunnel**: Traffic transits Cloudflare's edge. Quick Tunnel URLs are random and hard to guess, but treat them as public.
- **Tailscale**: Traffic stays on your private tailnet unless you explicitly use Funnel.
- **Dev Tunnels**: Requires authentication with the same Microsoft/GitHub/Entra account; private by default.

---

## Troubleshooting

### "cloudflared not found"

```bash
winget install --id Cloudflare.cloudflared
```

### "Rate limit exceeded" (Dev Tunnels)

You've hit the monthly bandwidth cap. Switch to Cloudflare Tunnel:
```bash
npm run tunnel:cloudflare
```

### Cannot connect on same Wi-Fi

1. Check your firewall allows inbound on the chosen port.
2. Confirm phone and PC are on the same network.
3. Re-verify the IP with `ipconfig` / `ifconfig`.

### Tunnel starts but page doesn't load

1. Confirm the production server is running: `curl http://localhost:3001/api/health`
2. Check the preflight output in the tunnel command's terminal.
3. Try the local URL first to rule out app issues.

---

## See also

- [How to Use Microsoft Dev Tunnels](devtunnel.md)
- [How to Run the Production Server](../dashboard/run-the-production-server.md)
