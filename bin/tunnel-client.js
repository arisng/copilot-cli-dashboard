#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';

const DEFAULT_PORT = 5173;
const DEFAULT_TUNNEL_ID = 'copiloting-agents-client';

const port = parsePort(process.env.PORT, DEFAULT_PORT);
const tunnelId = process.env.DEVTUNNEL_TUNNEL_ID || process.env.TUNNEL_ID || DEFAULT_TUNNEL_ID;

console.log(`Starting dev tunnel for client on http://localhost:${port} using tunnelId=${tunnelId}`);

try {
  runCmd('devtunnel', ['create', tunnelId]);
} catch (error) {
  console.log(`Tunnel create warning: ${error.message || error}. Continuing.`);
}

try {
  runCmd('devtunnel', ['port', 'create', tunnelId, '-p', String(port)]);
} catch (error) {
  console.log(`Port create warning: ${error.message || error}. Continuing.`);
}

runCmd('devtunnel', ['host', tunnelId]);

function runCmd(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${result.status}`);
  }
}

function parsePort(value, fallback) {
  const input = value || fallback;
  const parsed = Number.parseInt(input, 10);

  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  console.error(`Invalid PORT value "${value}". Expected a number between 1 and 65535.`);
  process.exit(1);
}
