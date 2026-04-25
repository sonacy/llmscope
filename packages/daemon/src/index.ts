import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const startedAt = Date.now();
const app = createApp({ config, startedAt });

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
});

console.log(`llmscope daemon listening on http://${server.hostname}:${server.port}`);
