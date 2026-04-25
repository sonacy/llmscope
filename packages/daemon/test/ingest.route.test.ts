import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { migrate } from '../src/db/migrate';
import { StubBroadcaster } from '../src/broadcaster';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  const broadcaster = new StubBroadcaster();
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db, broadcaster });
  return { app, broadcaster, db };
}

const fixture = {
  ts_start: 1714032000000,
  ts_end: 1714032001000,
  transport: 'http',
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0', authorization: 'Bearer sk-leak' },
  request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}',
  status: 200,
  response_headers: { 'content-type': 'application/json' },
  response_body: '{"choices":[{"message":{"content":"hello"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}',
};

describe('POST /api/ingest', () => {
  it('rejects without bearer', async () => {
    const { app } = setup();
    const res = await app.request('/api/ingest', { method: 'POST', body: JSON.stringify(fixture), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('accepts a valid event and broadcasts', async () => {
    const { app, broadcaster } = setup();
    const res = await app.request('/api/ingest', {
      method: 'POST',
      body: JSON.stringify(fixture),
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string; provider: string; source_kind: string };
    expect(json.id.startsWith('evt_')).toBe(true);
    expect(json.provider).toBe('openai');
    expect(json.source_kind).toBe('codex');
    expect(broadcaster.sent.length).toBe(1);
    expect(broadcaster.sent[0]!.kind).toBe('event_new');
  });

  it('rejects malformed json', async () => {
    const { app } = setup();
    const res = await app.request('/api/ingest', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects events that fail schema', async () => {
    const { app } = setup();
    const res = await app.request('/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ ...fixture, transport: 'tcp' }),
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    });
    expect(res.status).toBe(400);
  });
});
