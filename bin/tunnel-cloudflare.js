#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';

const DEFAULT_PORT = 3001;
const DEFAULT_TIMEOUT_MS = 2000;

const port = parsePort(process.env.PORT);
const appUrl = `http://localhost:${port}`;
const healthUrl = `http://127.0.0.1:${port}/api/health`;

const preflightResult = await runPreflightWithRetry();

if (!preflightResult.ok) {
  printPreflightFailure(preflightResult);
  process.exit(1);
}

console.log(`Production server detected at ${appUrl}.`);
console.log('Starting Cloudflare Quick Tunnel...');
console.log('');
console.log('Note: Quick Tunnels are temporary and the URL changes each run.');
console.log('      For a stable hostname, see: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/');
console.log('');

const child = spawn('cloudflared', ['tunnel', '--url', appUrl], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.error(
      [
        'Could not start Cloudflare Tunnel because "cloudflared" was not found.',
        '',
        'Install it first:',
        '',
        '  Windows (winget):',
        '    winget install --id Cloudflare.cloudflared',
        '',
        '  macOS (Homebrew):',
        '    brew install cloudflared',
        '',
        '  Linux:',
        '    See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
        '',
        'Then run this command again.',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.error(`Failed to start Cloudflare Tunnel: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});

async function runPreflight() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(healthUrl, {
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        type: 'unexpected-status',
        detail: `${response.status} ${response.statusText}`.trim(),
      };
    }

    let body;
    try {
      body = await response.json();
    } catch {
      return {
        ok: false,
        type: 'invalid-json',
      };
    }

    if (body?.ok === true) {
      return { ok: true };
    }

    return {
      ok: false,
      type: 'unexpected-body',
    };
  } catch (error) {
    const code = getErrorCode(error);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        type: 'timeout',
      };
    }

    if (code === 'ECONNREFUSED') {
      return {
        ok: false,
        type: 'refused',
      };
    }

    return {
      ok: false,
      type: 'request-error',
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPreflightWithRetry(maxAttempts = 8, initialDelayMs = 500) {
  let lastResult;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await runPreflight();
    if (lastResult.ok) {
      return lastResult;
    }

    if (attempt < maxAttempts) {
      const delayMs = initialDelayMs * attempt;
      console.log(`Preflight attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult;
}

function printPreflightFailure(result) {
  const details = getFailureDetails(result);
  const lines = [
    'Cloudflare Tunnel preflight failed.',
    '',
    ...details,
    '',
    'Start the production server first with:',
    '  npm start',
  ];

  if (port !== DEFAULT_PORT) {
    lines.push(
      '',
      `This tunnel command is using port ${port}. Start the server with the same PORT value before retrying.`,
    );
  }

  lines.push(
    '',
    'If you just ran npm start, wait for the build to finish and for the server to start listening, then retry:',
    '  npm run tunnel:cloudflare',
    '',
    'The tunnel will only start after the local production server is reachable.',
  );

  console.error(lines.join('\n'));
}

function getFailureDetails(result) {
  switch (result.type) {
    case 'refused':
      return [
        `${appUrl} is not accepting connections yet.`,
      ];
    case 'timeout':
      return [
        `${appUrl} did not respond within ${DEFAULT_TIMEOUT_MS}ms.`,
      ];
    case 'unexpected-status':
      return [
        `${healthUrl} responded with ${result.detail}.`,
        `A different process may already be listening on port ${port}.`,
      ];
    case 'invalid-json':
    case 'unexpected-body':
      return [
        `${appUrl} responded, but it did not look like the Copiloting Agents production server.`,
        `A different process may already be listening on port ${port}.`,
      ];
    case 'request-error':
      return [
        `Could not reach ${appUrl}: ${result.detail}.`,
      ];
    default:
      return [
        `Could not confirm that ${appUrl} is ready.`,
      ];
  }
}

function parsePort(value) {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  console.error(`Invalid PORT value "${value}". Expected a number between 1 and 65535.`);
  process.exit(1);
}

function getErrorCode(error) {
  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    if (
      'cause' in error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'code' in error.cause &&
      typeof error.cause.code === 'string'
    ) {
      return error.cause.code;
    }
  }

  return undefined;
}
