# How to Access the Dashboard From Your Phone

This guide shows how to open the dashboard on a phone while the app runs on your computer.

## When to use this guide

Use this when you want to inspect active Copilot CLI sessions from a mobile browser on the same network or through a tunnel.

## Before you start

- The dashboard is already running locally
- You know your computer's LAN IP address

## Same Wi-Fi network

1. Start the app so it listens on all interfaces:

   ```bash
   HOST=0.0.0.0 PORT=5173 npm run dev
   ```

   If you are using the production server instead, bind that process in the same way:

   ```bash
   HOST=0.0.0.0 PORT=3001 npm start
   ```

2. On your phone, open the matching URL:

   - `http://<PC_IP>:5173` for the development client
   - `http://<PC_IP>:3001` for the production server

3. If the page does not load, confirm that your firewall allows inbound traffic on the chosen port.

## Remote access through Dev Tunnels

1. Keep the dashboard running locally.
2. Install and sign in to Dev Tunnels:

   ```bash
   winget install Microsoft.devtunnel
   devtunnel user login
   ```

3. Expose the matching port:

   ```bash
   npm run tunnel:client
   ```

   Or, if you are serving production locally:

   ```bash
   npm run tunnel:prod
   ```

4. Open the tunnel URL from your phone and sign in with the same account if prompted.

## Next steps

- [How to Run the Production Server](run-the-production-server.md)
- [About the Dashboard Architecture](../../explanation/dashboard/how-it-works.md)

