import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { migrate } from '../src/db/migrate';
import { EventsRepo, type EventRow } from '../src/db/events-repo';
import { newEventId } from '@llmscope/core';

let db: Database;
let app: ReturnType<typeof createApp>;
let events: EventsRepo;

function row(over: Partial<Omit<EventRow, 'created_at'>> = {}): Omit<EventRow, 'created_at'> {
  const id = over.id ?? newEventId();
  return {
    id,
    ts_start: Date.now(),
    ts_end: Date.now() + 100,
    transport: 'http',
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    host: 'api.openai.com',
    status: 200,
    source_kind: 'codex',
    source_label: 'Codex CLI',
    source_confidence: 0.98,
    provider: 'openai',
    model: 'gpt-4o',
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost_usd: 0.0001,
    latency_ms: 100,
    request_headers: '{}',
    response_headers: '{}',
    request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"refactor this code"}]}',
    response_body: '{}',
    request_body_truncated: 0,
    response_body_truncated: 0,
    reassembled_meta: null,
    error: null,
    parent_id: null,
    ...over,
  };
}

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  events = new EventsRepo(db);
  app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
});

const auth = { authorization: 'Bearer t' };

describe('GET /api/events', () => {
  it('paginates 60 events across 2 pages', async () => {
    for (let i = 0; i < 60; i++) {
      events.insert(row({ source_kind: i < 30 ? 'codex' : 'claude-code' }));
    }
    const r1 = await app.request('/api/events?limit=50', { headers: auth });
    const j1 = (await r1.json()) as { events: { id: string }[]; next_cursor: string | null };
    expect(j1.events.length).toBe(50);
    expect(j1.next_cursor).not.toBeNull();
    const r2 = await app.request(`/api/events?limit=50&cursor=${encodeURIComponent(j1.next_cursor!)}`, { headers: auth });
    const j2 = (await r2.json()) as { events: { id: string }[]; next_cursor: string | null };
    expect(j2.events.length).toBe(10);
    expect(j2.next_cursor).toBeNull();
    const seen = new Set([...j1.events, ...j2.events].map((e) => e.id));
    expect(seen.size).toBe(60);
  });

  it('filters by source', async () => {
    events.insert(row({ source_kind: 'codex' }));
    events.insert(row({ source_kind: 'claude-code' }));
    const r = await app.request('/api/events?source=claude-code', { headers: auth });
    const j = (await r.json()) as { events: { source: { kind: string } }[] };
    expect(j.events.length).toBe(1);
    expect(j.events[0]!.source.kind).toBe('claude-code');
  });

  it('FTS search via q matches request body', async () => {
    events.insert(row({ request_body: '{"messages":[{"role":"user","content":"hummingbirds migrate"}]}' }));
    events.insert(row({ request_body: '{"messages":[{"role":"user","content":"completely different topic"}]}' }));
    const r = await app.request('/api/events?q=hummingbirds', { headers: auth });
    const j = (await r.json()) as { events: { id: string }[] };
    expect(j.events.length).toBe(1);
  });

  it('produces preview from last user message', async () => {
    events.insert(row({ request_body: '{"messages":[{"role":"system","content":"sys"},{"role":"user","content":"refactor this code"}]}' }));
    const r = await app.request('/api/events', { headers: auth });
    const j = (await r.json()) as { events: { preview: string }[] };
    expect(j.events[0]!.preview).toBe('refactor this code');
  });

  it('rejects bad query', async () => {
    const r = await app.request('/api/events?status=weird', { headers: auth });
    expect(r.status).toBe(400);
  });
});
