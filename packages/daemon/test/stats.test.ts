import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { newEventId } from '@llmscope/core';
import { migrate } from '../src/db/migrate';
import { EventsRepo, type EventRow } from '../src/db/events-repo';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  const events = new EventsRepo(db);
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
  return { db, events, app };
}

function row(over: Partial<Omit<EventRow, 'created_at'>> = {}): Omit<EventRow, 'created_at'> {
  return {
    id: newEventId(),
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
    model: 'gpt-4o-mini',
    prompt_tokens: 1_000_000,
    completion_tokens: 500_000,
    total_tokens: 1_500_000,
    cost_usd: 0,
    latency_ms: 100,
    request_headers: '{}',
    response_headers: '{}',
    request_body: null,
    response_body: null,
    request_body_truncated: 0,
    response_body_truncated: 0,
    reassembled_meta: null,
    error: null,
    parent_id: null,
    ...over,
  };
}

const auth = { authorization: 'Bearer t' };

describe('GET /api/stats', () => {
  it('returns series + totals + cost + unpriced_models', async () => {
    const { app, events } = setup();
    events.insert(row());
    events.insert(row({ provider: 'anthropic', model: 'claude-3-5-sonnet' }));
    events.insert(row({ model: 'totally-fake-model-9001' }));

    const r = await app.request('/api/stats?range=7d&bucket=day&groupBy=provider', { headers: auth });
    expect(r.status).toBe(200);
    const j = (await r.json()) as {
      series: { group_value: string; request_count: number }[];
      totals: { request_count: number; prompt_tokens: number; cost_usd: number; unpriced_models: string[] };
    };
    expect(j.totals.request_count).toBe(3);
    expect(j.totals.cost_usd).toBeGreaterThan(0);
    expect(j.totals.unpriced_models).toContain('totally-fake-model-9001');
    const providers = new Set(j.series.map((s) => s.group_value));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
  });

  it('rejects bad range', async () => {
    const { app } = setup();
    const r = await app.request('/api/stats?range=42d', { headers: auth });
    expect(r.status).toBe(400);
  });
});
