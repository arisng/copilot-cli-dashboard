import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import router from './router.js';
import { gcService } from './gcService.js';

const DEFAULT_PORT = 3001;
const app = express();
const configuredPort = process.env.PORT;
const hasExplicitPort = configuredPort !== undefined;
// Keep the dev server on the fixed port so the Vite proxy remains aligned with 3001.
const allowPortFallback = !hasExplicitPort && process.env.npm_lifecycle_event !== 'dev';

app.use(cors());
app.use(express.json());
app.use('/api', router);

// Serve built client in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// GC status endpoint (for monitoring)
app.get('/api/admin/gc-status', (req, res) => {
  res.json({
    enabled: process.env.COPILOT_ENABLE_AUTO_GC !== 'false',
    running: gcService.isRunning(),
    intervalHours: parseInt(process.env.COPILOT_GC_INTERVAL_HOURS || '24', 10),
  });
});

app.post('/api/admin/gc-run', async (req, res) => {
  const { dryRun = false } = req.body;
  try {
    const result = await gcService.runGC({ dryRun });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

void main().catch((error: unknown) => {
  if (isPortInUseError(error) && hasExplicitPort) {
    console.error(
      `Port ${configuredPort} is already in use. Set PORT to a different value or stop the process using it.`,
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }

  process.exit(1);
});

async function main() {
  const requestedPort = parsePort(configuredPort ?? String(DEFAULT_PORT));
  const { port, server } = await listenWithFallback(requestedPort, allowPortFallback);

  if (!hasExplicitPort && port !== requestedPort) {
    console.log(`Port ${requestedPort} is already in use; using ${port} instead.`);
  }

  // Initialize garbage collection service if enabled
  if (process.env.COPILOT_ENABLE_AUTO_GC !== 'false') {
    const intervalHours = parseInt(process.env.COPILOT_GC_INTERVAL_HOURS || '24', 10);
    gcService.start(intervalHours);
    console.log(`[GC] Garbage collection service started (interval: ${intervalHours}h)`);

    // Run initial GC in dry-run mode to log what would be cleaned up
    gcService.runGC({ dryRun: true }).then(result => {
      console.log(`[GC] Initial scan: ${result.scanned} sessions, ${result.archived} would be archived, ${result.deleted} would be deleted`);
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully');
    gcService.stop();
    server.close(() => {
      console.log('[Server] Closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully');
    gcService.stop();
    server.close(() => {
      console.log('[Server] Closed');
      process.exit(0);
    });
  });

  printStartupBanner(port);
}

async function listenWithFallback(startPort: number, allowFallback: boolean) {
  let port = startPort;

  while (port <= 65535) {
    try {
      const server = await listenOnPort(port);
      return { port, server };
    } catch (error) {
      if (!allowFallback || !isPortInUseError(error)) {
        throw error;
      }

      port += 1;
    }
  }

  throw new Error(`No available port found starting at ${startPort}.`);
}

function listenOnPort(port: number): Promise<import('http').Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once('listening', () => {
      resolve(server);
    });

    server.once('error', reject);
  });
}

function parsePort(value: string): number {
  const parsedPort = Number(value);

  if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
    return parsedPort;
  }

  throw new Error(`Invalid PORT value "${value}". Expected a number between 1 and 65535.`);
}

function isPortInUseError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EADDRINUSE'
  );
}

function printStartupBanner(port: number) {
  const reset = '\x1b[0m';
  const bold  = '\x1b[1m';
  const cyan  = '\x1b[36m';
  const white = '\x1b[97m';
  const gray  = '\x1b[90m';

  // Width is the number of visible characters between the box borders
  const W = 46;

  const border = (l: string, r: string) =>
    `${gray}${l}${'─'.repeat(W)}${r}${reset}`;

  // A row where `text` is the visible content (no ANSI), `styled` is the styled version
  const row = (visibleText: string, styledText: string) => {
    const pad = W - 2 - visibleText.length; // 2 for the leading space + trailing space
    return `${gray}│${reset} ${styledText}${' '.repeat(Math.max(0, pad))} ${gray}│${reset}`;
  };

  const blank = `${gray}│${reset}${' '.repeat(W)}${gray}│${reset}`;

  const url        = `http://localhost:${port}`;
  const urlVisible = `Local:  ${url}`;
  const urlStyled  = `${gray}Local:${reset}  ${cyan}${bold}${url}${reset}`;

  const title        = '◆  Copiloting Agents';
  const titlePad     = Math.floor((W - title.length) / 2);
  const titleStyled  = `${' '.repeat(titlePad)}${bold}${white}${title}${reset}`;
  const titleVisible = ' '.repeat(titlePad) + title;

  const tagline        = '🍳  Cooking agents...';
  const taglinePad     = Math.floor((W - tagline.length) / 2);
  const taglineStyled  = `${' '.repeat(taglinePad)}${gray}${tagline}${reset}`;
  const taglineVisible = ' '.repeat(taglinePad) + tagline;

  console.log('');
  console.log(border('┌', '┐'));
  console.log(blank);
  console.log(row(titleVisible, titleStyled));
  console.log(row(taglineVisible, taglineStyled));
  console.log(blank);
  console.log(border('├', '┤'));
  console.log(blank);
  console.log(row(urlVisible, urlStyled));
  console.log(blank);
  console.log(border('└', '┘'));
  console.log('');
}
