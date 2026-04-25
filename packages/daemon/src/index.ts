import { mkdirSync } from 'node:fs';
import { createApp } from './app';
import { loadConfig } from './config';
import { ensureToken } from './auth';
import { openDb } from './db/connect';
import { migrate } from './db/migrate';
import { HubBroadcaster } from './broadcaster';
import { createStreamHandlers } from './stream';

const config = loadConfig();
mkdirSync(config.homeDir, { recursive: true });
const token = ensureToken(config.tokenPath);
const db = openDb(config.dbPath);
migrate(db);
const startedAt = Date.now();
const broadcaster = new HubBroadcaster();
const app = createApp({ config, startedAt, token, db, broadcaster });
const stream = createStreamHandlers({ broadcaster, token, port: config.port });

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch(req, server) {
    const upgrade = stream.upgrade(req, server);
    if (upgrade !== undefined) return upgrade;
    if (new URL(req.url).pathname === '/api/stream') return new Response(null);
    return app.fetch(req);
  },
  websocket: stream.websocket,
});

console.log(`llmscope daemon listening on http://${server.hostname}:${server.port}`);
console.log(`token at: ${config.tokenPath}`);
