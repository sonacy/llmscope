import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../src/db/migrate';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { processIngest } from '../src/ingest/pipeline';
import { EventsRepo } from '../src/db/events-repo';
import { SourcesRepo } from '../src/db/sources-repo';
import { ReplaysRepo } from '../src/db/replays-repo';
import { MASK_TOKEN } from '@llmscope/core';

function setup(fetchImpl?: typeof fetch) {
  const db = new Database(':memory:');
  migrate(db);
  const events = new EventsRepo(db);
  const sources = new SourcesRepo(db);
  const replays = new ReplaysRepo(db);
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db, fetchImpl });
  return { db, events, sources, replays, app };
}

const auth = { authorization: 'Bearer t' };

const baseEvent = (overrideHeaders: Record<string, string> = {}) => ({
  ts_start: 1, ts_end: 2, transport: 'http' as const, method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0', ...overrideHeaders },
  request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}',
  status: 200,
  response_headers: { 'content-type': 'application/json' },
  response_body: '{"choices":[{"message":{"content":"hello"}}]}',
});

describe('POST /api/events/:id/replay', () => {
  it('replays through fetchImpl and creates a child event with parent_id', async () => {
    let called = false;
    const fakeFetch: typeof fetch = async (url, init) => {
      called = true;
      expect(String(url)).toContain('api.openai.com');
      expect(init?.method).toBe('POST');
      return new Response('{"choices":[{"message":{"content":"replayed"}}]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const { app, events, sources, replays } = setup(fakeFetch);
    // No Authorization on the captured event — replay proceeds without auth (target endpoint doesn't need one in this fixture).
    const parent = processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, baseEvent());
    const r = await app.request(`/api/events/${parent.id}/replay`, { method: 'POST', headers: auth });
    expect(r.status).toBe(201);
    const j = (await r.json()) as { new_event_id: string; parent_id: string };
    expect(called).toBe(true);
    expect(j.parent_id).toBe(parent.id);
    const child = events.getById(j.new_event_id)!;
    expect(child.parent_id).toBe(parent.id);
    expect(child.response_body).toContain('replayed');
    expect(replays.childrenOf(parent.id)).toContain(child.id);
  });

  it('returns 409 when authorization was masked', async () => {
    const fakeFetch: typeof fetch = async () => new Response('{}');
    const { app, events, sources } = setup(fakeFetch);
    // ingest event with no Authorization at all — pipeline does not auto-add it,
    // so we must force a masked Auth into the stored row to test the 409 branch.
    const parent = processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, baseEvent({ authorization: 'Bearer should-mask' }));
    // After ingest, Auth is masked already by maskHeaders.
    const stored = events.getById(parent.id)!;
    expect(stored.request_headers).toContain(MASK_TOKEN);
    const r = await app.request(`/api/events/${parent.id}/replay`, { method: 'POST', headers: auth });
    expect(r.status).toBe(409);
  });

  it('returns 404 for unknown id', async () => {
    const { app } = setup();
    const r = await app.request('/api/events/evt_NOTEXIST/replay', { method: 'POST', headers: auth });
    expect(r.status).toBe(404);
  });
});
