'use strict';

const { describe, it, expect, beforeAll, afterAll } = require('bun:test');
const http = require('node:http');
const { mkdtempSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let pluginServer;
let pluginPort;
let upstreamServer;
let upstreamPort;
let daemonServer;
let daemonPort;
let homeDir;

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'llmscope-server-e2e-'));
  writeFileSync(join(homeDir, 'token'), 'tok-' + 'a'.repeat(32) + '\n', { mode: 0o600 });
  process.env.LLMSCOPE_HOME = homeDir;
  process.env.LLMSCOPE_TOKEN = 'tok-' + 'a'.repeat(32);
  process.env.LLMSCOPE_PORT = '0';

  // 1. Mock upstream (pretend to be api.openai.com).
  upstreamServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: 'mocked response for: ' + body } }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
      );
    });
  });
  await new Promise((r) => upstreamServer.listen(0, '127.0.0.1', r));
  upstreamPort = upstreamServer.address().port;

  // 2. Start the llmscope daemon (in-process).
  const { Database } = await import('bun:sqlite');
  const { createApp } = await import('../../daemon/src/app');
  const { loadConfig } = await import('../../daemon/src/config');
  const { migrate } = await import('../../daemon/src/db/migrate');
  const db = new Database(':memory:');
  migrate(db);
  const app = createApp({
    config: loadConfig(process.env),
    startedAt: Date.now(),
    token: process.env.LLMSCOPE_TOKEN,
    db,
  });
  daemonServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (req) => app.fetch(req),
  });
  daemonPort = daemonServer.port;
  process.env.LLMSCOPE_PORT = String(daemonPort);

  // 3. Start the whistle plugin's `server` export with a fake whistle setup.
  // We have to clear the require cache so post.js picks up the new daemon port env var.
  delete require.cache[require.resolve('../src/post')];
  delete require.cache[require.resolve('../src/index')];
  const plugin = require('../src/index');
  pluginServer = http.createServer();
  plugin.server(pluginServer, {});
  await new Promise((r) => pluginServer.listen(0, '127.0.0.1', r));
  pluginPort = pluginServer.address().port;
});

afterAll(() => {
  pluginServer?.close?.();
  upstreamServer?.close?.();
  daemonServer?.stop?.(true);
});

describe('whistle plugin `server` export — full forward-and-capture chain', () => {
  it('forwards a request, returns upstream response, and posts a captured event to the daemon', async () => {
    // Simulate whistle dispatching a matched request to our plugin.
    const reqBody = JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    const upstreamHost = `127.0.0.1:${upstreamPort}`;

    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: pluginPort,
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {
            // whistle would set host to the *real* destination so the plugin
            // can reconstruct the URL; we point at our mock upstream.
            host: upstreamHost,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(reqBody),
            'user-agent': 'OpenAI/Codex-CLI 1.0',
            authorization: 'Bearer sk-leak-fake',
            // 'x-whistle-https-request': absent → http upstream
          },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body }));
        },
      );
      req.on('error', reject);
      req.end(reqBody);
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('mocked response');

    // Give the plugin a beat to POST to the daemon.
    await new Promise((r) => setTimeout(r, 200));

    // Confirm the daemon got the event.
    const r = await fetch(`http://127.0.0.1:${daemonPort}/api/events?limit=10`, {
      headers: { authorization: `Bearer ${process.env.LLMSCOPE_TOKEN}` },
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.events)).toBe(true);
    expect(j.events.length).toBeGreaterThanOrEqual(1);
    const last = j.events[0];
    expect(last.url).toContain('/v1/chat/completions');
    expect(last.provider).toBe('unknown'); // our mock host isn't openai.com so provider detection rightly says unknown
    expect(last.transport).toBe('http');
  });

  it('writes diagnostic entries to ~/.llmscope/plugin.log', () => {
    const logPath = join(homeDir, 'plugin.log');
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    const labels = lines.map((l) => JSON.parse(l).label);
    expect(labels).toContain('module.load');
    expect(labels).toContain('server.attach');
    expect(labels).toContain('server.request');
    expect(labels).toContain('server.complete');
    expect(labels).toContain('server.ingest');
  });
});
