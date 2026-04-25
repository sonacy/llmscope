'use strict';

const { describe, it, expect, beforeAll, afterAll } = require('bun:test');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let server;
let port;
let received = [];

beforeAll(async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'llmscope-stats-'));
  writeFileSync(join(homeDir, 'token'), 'tok-' + 'a'.repeat(32) + '\n', { mode: 0o600 });
  process.env.LLMSCOPE_HOME = homeDir;
  process.env.LLMSCOPE_TOKEN = 'tok-' + 'a'.repeat(32);
  process.env.LLMSCOPE_PORT = '0';

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
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (req) => {
      let captured = null;
      if (new URL(req.url).pathname === '/api/ingest' && req.method === 'POST') {
        captured = await req.clone().json();
      }
      const r = await app.fetch(req);
      if (captured) received.push(captured);
      return r;
    },
  });
  port = server.port;
  process.env.LLMSCOPE_PORT = String(port);
});

afterAll(() => {
  server?.stop?.(true);
});

describe('whistle stats-frame handling', () => {
  it('parses a frame with new-style (req.body / res.body) and posts to daemon', async () => {
    const mod = require('../src/index');
    const frame = JSON.stringify({
      id: 'whstl-1',
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      statusCode: 200,
      reqHeaders: { 'user-agent': 'OpenAI/Codex-CLI 1.0', 'content-type': 'application/json' },
      resHeaders: { 'content-type': 'application/json' },
      req: { body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}' },
      res: { body: '{"choices":[{"message":{"content":"hello"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}' },
      startTime: 1714032000000,
      endTime: 1714032001000,
    });
    received = [];
    mod._handleStatFrame(frame);
    await new Promise((r) => setTimeout(r, 80));
    expect(received.length).toBe(1);
    expect(received[0].url).toContain('api.openai.com');
    expect(received[0].method).toBe('POST');
  });

  it('skips non-LLM hosts', async () => {
    const mod = require('../src/index');
    received = [];
    const frame = JSON.stringify({
      id: 'whstl-2',
      url: 'https://example.com/foo',
      method: 'GET',
      statusCode: 200,
      reqHeaders: {},
      resHeaders: {},
    });
    mod._handleStatFrame(frame);
    await new Promise((r) => setTimeout(r, 50));
    expect(received.length).toBe(0);
  });

  it('handles malformed JSON without throwing', () => {
    const mod = require('../src/index');
    expect(() => mod._handleStatFrame('not json')).not.toThrow();
  });

  it('captures via body-shape fallback for unknown hosts', async () => {
    const mod = require('../src/index');
    received = [];
    const frame = JSON.stringify({
      id: 'whstl-3',
      url: 'https://my-private-llm.internal/v1/complete',
      method: 'POST',
      statusCode: 200,
      reqHeaders: { 'user-agent': 'curl/8.0' },
      resHeaders: { 'content-type': 'application/json' },
      req: { body: '{"model":"local-7b","messages":[]}' },
      res: { body: '{}' },
    });
    mod._handleStatFrame(frame);
    await new Promise((r) => setTimeout(r, 80));
    expect(received.length).toBe(1);
  });
});
