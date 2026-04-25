import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../src/db/migrate';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { processIngest } from '../src/ingest/pipeline';
import { EventsRepo } from '../src/db/events-repo';
import { SourcesRepo } from '../src/db/sources-repo';
import { HubBroadcaster, type BroadcastFrame } from '../src/broadcaster';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  const events = new EventsRepo(db);
  const sources = new SourcesRepo(db);
  const broadcaster = new HubBroadcaster();
  const seen: BroadcastFrame[] = [];
  broadcaster.subscribe((f) => seen.push(f));
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db, broadcaster });
  return { db, app, events, sources, seen };
}

const auth = { authorization: 'Bearer t', 'content-type': 'application/json' };

describe('/api/sources', () => {
  it('lists builtin + user split', async () => {
    const { app } = setup();
    const r = await app.request('/api/sources', { headers: auth });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { builtin: unknown[]; user: unknown[] };
    expect(j.builtin.length).toBeGreaterThan(0);
    expect(j.user.length).toBe(0);
  });

  it('creates a user rule then lists it', async () => {
    const { app } = setup();
    const create = await app.request('/api/sources', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ match_type: 'ua_prefix', pattern: 'my-app/', kind: 'my-app', label: 'My App', confidence: 0.99 }),
    });
    expect(create.status).toBe(201);
    const list = await (await app.request('/api/sources', { headers: auth })).json() as { user: { pattern: string }[] };
    expect(list.user.some((r) => r.pattern === 'my-app/')).toBe(true);
  });

  it('forbids deleting built-in rule', async () => {
    const { app, sources } = setup();
    const builtin = sources.splitByOrigin().builtin[0]!;
    const r = await app.request(`/api/sources/${builtin.id}`, { method: 'DELETE', headers: auth });
    expect(r.status).toBe(403);
  });

  it('apply re-tags matching events and emits event_update frames', async () => {
    const { app, events, sources, seen } = setup();
    // Ingest two events with a custom UA that won't match built-ins.
    processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
      ts_start: Date.now(), ts_end: Date.now() + 10, transport: 'http', method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      request_headers: { 'user-agent': 'my-app/1.0' },
      request_body: '{"model":"gpt-4o","messages":[]}',
      status: 200, response_headers: {}, response_body: '{}',
    });
    processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
      ts_start: Date.now(), ts_end: Date.now() + 10, transport: 'http', method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      request_headers: { 'user-agent': 'my-app/2.0' },
      request_body: '{"model":"gpt-4o","messages":[]}',
      status: 200, response_headers: {}, response_body: '{}',
    });
    const create = await app.request('/api/sources', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ match_type: 'ua_prefix', pattern: 'my-app/', kind: 'my-app', label: 'My App', confidence: 0.99 }),
    });
    const created = (await create.json()) as { id: number };
    const apply = await app.request(`/api/sources/${created.id}/apply`, { method: 'POST', headers: auth });
    expect(apply.status).toBe(200);
    const j = (await apply.json()) as { matched: number };
    expect(j.matched).toBe(2);
    expect(seen.filter((f) => f.kind === 'event_update').length).toBe(2);
  });
});
