# Remote Access Guide

Access the Copiloting Agents dashboard from your phone or another device when you're away from your development machine.

## Access Priority

Choose the option that fits your situation:

1. **[Same Wi-Fi (No tunnel)](#same-wi-fi-no-tunnel)** — simplest, zero dependencies
2. **[Cloudflare Tunnel](#cloudflare-tunnel-recommended)** — best free public option
3. **[Tailscale](#tailscale-secondary)** — best for private device-to-device access
4. **[Microsoft Dev Tunnels](#microsoft-dev-tunnels-fallback)** — fallback option

---

## Same Wi-Fi (No tunnel)

When your phone and laptop are on the same home Wi-Fi, use direct LAN access.

### 1. Find your PC/laptop IP address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
```

**macOS/Linux:**
```bash
ifconfig
# or
ip addr show
```

### 2. Start the app with host binding

```bash
# Bind to all network interfaces
HOST=0.0.0.0 npm start
```

### 3. Open from your phone

Navigate to: `http://<PC_IP>:3001`

### Firewall notes

You may need to allow the port through Windows Defender Firewall or your system firewall. The app binds to all interfaces (`0.0.0.0`) when `HOST` is set.

---

## Cloudflare Tunnel (Recommended)

Cloudflare Quick Tunnels expose your local server through Cloudflare's edge network. This is the recommended option for free public access because it's simple and reliable for ad hoc sharing.

### Quick start

```bash
# Install cloudflared (one-time)
winget install --id Cloudflare.cloudflared

# Start production server
npm start

# In another terminal, start the tunnel
npm run tunnel:cloudflare
```

The command prints a public URL like `https://random-string.trycloudflare.com`. Open this URL from your phone.

### How it works

The `tunnel:cloudflare` script:
1. Preflights the production server at `http://localhost:3001/api/health`
2. Launches `cloudflared tunnel --url http://localhost:3001`
3. Prints the public URL for you to use

### Custom port

If `npm start` auto-selected a different port (e.g., 3002):

```bash
PORT=3002 npm start
PORT=3002 npm run tunnel:cloudflare
```

### Named tunnel with stable hostname (optional)

Quick Tunnels use a random URL each time. For a stable hostname:

1. **Authenticate with Cloudflare:**
   ```bash
   cloudflared tunnel login
   ```
   This opens a browser to authenticate with your Cloudflare account.

2. **Create a named tunnel:**
   ```bash
   cloudflared tunnel create copiloting-agents
   ```

3. **Route DNS to your domain:**
   ```bash
   cloudflared tunnel route dns copiloting-agents dashboard.yourdomain.com
   ```

4. **Run the named tunnel:**
   ```bash
   cloudflared tunnel run copiloting-agents
   ```

See [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/) for full details.

### Limitations

| Limit | Value | Notes |
|-------|-------|-------|
| URL stability | Random per run | Use named tunnels for stable URLs |
| Max in-flight requests | Limited | Quick Tunnels are for development, not production loads |
| SSE support | No | Server-Sent Events do not work through Quick Tunnels |
| Intended use | Development/testing | Not for production hosting |

---

## Tailscale (Secondary)

Tailscale is ideal if you already use it for your personal devices. It creates a private mesh network (tailnet) between your devices and can expose services publicly via Funnel.

### Quick start

```bash
# Install Tailscale and authenticate
tailscale up

# Start the production server
npm start

# Expose publicly via Funnel
tailscale funnel --bg --https=443 3001
```

### Limitations

| Limit | Value | Notes |
|-------|-------|-------|
| Egress bandwidth | ~1 Gbps | Subject to Tailscale terms |
| Authentication | Required | Must be logged into your tailnet |
| Funnel availability | Account-dependent | Check Tailscale plan for Funnel access |

See [Tailscale Funnel documentation](https://tailscale.com/kb/1223/funnel).

---

## Microsoft Dev Tunnels (Fallback)

Dev Tunnels remain available as a fallback if Cloudflare or Tailscale don't work in your environment.

### Quick start

```bash
# Install devtunnel (one-time)
winget install Microsoft.devtunnel
devtunnel user login

# Start production server
npm start

# In another terminal, start the tunnel
npm run tunnel:prod
```

### Fixed tunnel IDs

The repo uses fixed tunnel IDs so you don't get random URLs each time:

- `copiloting-agents-prod` (port 3001)
- `copiloting-agents-client` (port 5173)

Override with:
```bash
set DEVTUNNEL_TUNNEL_ID=myapp-prod && npm run tunnel:prod
# PowerShell:
$Env:DEVTUNNEL_TUNNEL_ID = 'myapp-prod'; npm run tunnel:prod
```

### Limitations

| Limit | Value | Notes |
|-------|-------|-------|
| Bandwidth | ~5 GB/month | Observed rate limit errors at this threshold |
| Rate limits | 429 errors | Too many requests trigger temporary blocks |
| Reliability | Variable | Service-side errors may occur even when local app is healthy |

See [docs/devtunnel.md](devtunnel.md) for detailed documentation.

---

## Provider Comparison

| Feature | Cloudflare Quick Tunnel | Tailscale Funnel | Microsoft Dev Tunnels |
|---------|------------------------|------------------|----------------------|
| **Setup complexity** | Low | Medium | Medium |
| **Account required** | No (Quick Tunnel) | Yes | Yes |
| **URL stability** | Random per run | Configurable | Fixed with ID |
| **Same-network performance** | Via Cloudflare edge | Direct (fastest) | Via Microsoft edge |
| **Public access** | Yes | Via Funnel | Yes |
| **Private mesh** | No | Yes (tailnet) | No |
| **Bandwidth cap** | Generous* | ~1 Gbps | ~5 GB/month |
| **Rate limiting** | Minimal observed | Minimal observed | 429 errors common |
| **SSE support** | No | Yes | Yes |
| **Best for** | Quick public sharing | Private device mesh | Fallback only |

\* Cloudflare Quick Tunnels are designed for development and have in-flight request limits rather than strict bandwidth caps.

---

## Security Notes

- **Same Wi-Fi**: Direct LAN access is the most private option when both devices are on the same trusted network.
- **Cloudflare Tunnel**: Traffic goes through Cloudflare's edge. The Quick Tunnel URL is random and hard to guess, but treat it as public.
- **Tailscale**: Traffic between your devices stays on your private tailnet. Funnel exposes only what you explicitly share.
- **Dev Tunnels**: Private by default; requires authentication with the same Microsoft/GitHub/Entra account.

---

## Troubleshooting

### "cloudflared not found"

Install cloudflared:
```bash
winget install --id Cloudflare.cloudflared
```

### "Rate limit exceeded" (Dev Tunnels)

You've hit the Dev Tunnels bandwidth or request limit. Switch to Cloudflare Tunnel:
```bash
npm run tunnel:cloudflare
```

### Cannot connect on same Wi-Fi

1. Verify your PC firewall allows inbound connections on port 3001
2. Ensure your phone and PC are on the same network
3. Double-check the IP address with `ipconfig` or `ifconfig`

### Tunnel starts but page doesn't load

1. Verify the production server is running: `npm start`
2. Check the preflight output in the tunnel command
3. Try the local URL first: `http://localhost:3001`
