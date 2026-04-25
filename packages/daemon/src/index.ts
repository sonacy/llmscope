import { mkdirSync } from 'node:fs';
import { createApp } from './app';
import { loadConfig } from './config';
import { ensureToken } from './auth';
import { openDb } from './db/connect';
import { migrate } from './db/migrate';

const config = loadConfig();
mkdirSync(config.homeDir, { recursive: true });
const token = ensureToken(config.tokenPath);
const db = openDb(config.dbPath);
migrate(db);
const startedAt = Date.now();
const app = createApp({ config, startedAt, token, db });

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
});

console.log(`llmscope daemon listening on http://${server.hostname}:${server.port}`);
console.log(`token at: ${config.tokenPath}`);
