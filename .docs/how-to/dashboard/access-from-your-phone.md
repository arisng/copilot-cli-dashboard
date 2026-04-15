# How to Access the Dashboard From Your Phone

> **This page has moved.** The complete guide — covering LAN access, Cloudflare Tunnel, Tailscale, and Microsoft Dev Tunnels — is now at:
>
> **[How to Access the Dashboard Remotely](../operations/remote-access.md)**

The operations guide covers all access methods with a provider comparison table and troubleshooting steps.

## Quick reference

For the common case (same Wi-Fi):

```bash
HOST=0.0.0.0 npm start
# then open http://<PC_IP>:3001 on your phone
```

For a public URL without an account:

```bash
npm start
npm run tunnel:cloudflare   # second terminal
```

## See also

- [How to Access the Dashboard Remotely](../operations/remote-access.md)
- [How to Run the Production Server](run-the-production-server.md)

