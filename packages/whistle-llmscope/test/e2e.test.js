'use strict';

const { describe, it, expect, beforeAll, afterAll } = require('bun:test');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let server;
let port;
let homeDir;

beforeAll(async () => {
  homeDir = mkdtempSync(join(tmpdir(), 'llmscope-e2e-'));
  writeFileSync(join(homeDir, 'token'), 'test-token-' + 'a'.repeat(32) + '\n', { mode: 0o600 });

  process.env.LLMSCOPE_HOME = homeDir;
  process.env.LLMSCOPE_DB = join(homeDir, 'db.sqlite');
  process.env.LLMSCOPE_TOKEN_PATH = join(homeDir, 'token');
  process.env.LLMSCOPE_PORT = '0';
  process.env.LLMSCOPE_TOKEN = 'test-token-' + 'a'.repeat(32);

  const { Database } = await import('bun:sqlite');
  const { createApp } = await import('../../daemon/src/app');
  const { loadConfig } = await import('../../daemon/src/config');
  const { migrate } = await import('../../daemon/src/db/migrate');
  const cfg = loadConfig(process.env);
  const db = new Database(':memory:');
  migrate(db);
  const app = createApp({ config: cfg, startedAt: Date.now(), token: process.env.LLMSCOPE_TOKEN, db });
  server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch });
  port = server.port;
  process.env.LLMSCOPE_PORT = String(port);
});

afterAll(() => {
  server?.stop?.(true);
});

describe('whistle plugin → daemon', () => {
  it('posts a captured event end-to-end', async () => {
    const { postEvent } = require('../src/post');
    const { buildEvent } = require('../src/capture');
    const event = buildEvent({
      tsStart: 1714032000000,
      tsEnd: 1714032001000,
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      requestHeaders: { authorization: 'Bearer sk-leak', 'user-agent': 'OpenAI/Codex-CLI 1.0' },
      requestBody: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}',
      status: 200,
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"choices":[{"message":{"content":"hello"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}',
    });

    const status = await new Promise((resolve, reject) => {
      postEvent(event, (err, st) => (err ? reject(err) : resolve(st)));
    });
    expect(status).toBe(201);
  });
});
