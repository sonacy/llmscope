import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { newEventId } from '@llmscope/core';
import { migrate } from '../src/db/migrate';
import { EventsRepo, type EventRow } from '../src/db/events-repo';

function setup(): EventsRepo {
  const db = new Database(':memory:');
  migrate(db);
  return new EventsRepo(db);
}

function makeEvent(over: Partial<Omit<EventRow, 'created_at'>> = {}): Omit<EventRow, 'created_at'> {
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
    model: 'gpt-4o',
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost_usd: 0.0001,
    latency_ms: 100,
    request_headers: '{"content-type":"application/json"}',
    response_headers: '{"content-type":"application/json"}',
    request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hello world"}]}',
    response_body: '{"choices":[{"message":{"content":"hi"}}]}',
    request_body_truncated: 0,
    response_body_truncated: 0,
    reassembled_meta: null,
    error: null,
    parent_id: null,
    ...over,
  };
}

describe('EventsRepo', () => {
  it('inserts and retrieves by id', () => {
    const repo = setup();
    const e = makeEvent();
    repo.insert(e);
    const got = repo.getById(e.id);
    expect(got).not.toBeNull();
    expect(got!.model).toBe('gpt-4o');
  });

  it('lists with provider filter', () => {
    const repo = setup();
    repo.insert(makeEvent({ provider: 'openai' }));
    repo.insert(makeEvent({ provider: 'anthropic' }));
    const r = repo.list({ provider: 'openai' });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]!.provider).toBe('openai');
  });

  it('paginates by id desc with cursor', () => {
    const repo = setup();
    for (let i = 0; i < 5; i++) repo.insert(makeEvent());
    const a = repo.list({ limit: 2 });
    expect(a.rows.length).toBe(2);
    expect(a.nextCursor).not.toBeNull();
    const b = repo.list({ limit: 2, cursor: a.nextCursor! });
    expect(b.rows.length).toBe(2);
    expect(b.rows[0]!.id < a.rows[1]!.id).toBe(true);
  });

  it('full-text search via FTS5', () => {
    const repo = setup();
    repo.insert(makeEvent({ request_body: 'about hummingbirds and migration' }));
    repo.insert(makeEvent({ request_body: 'completely different topic' }));
    const r = repo.list({ q: 'hummingbird*' });
    expect(r.rows.length).toBe(1);
  });

  it('error status filter', () => {
    const repo = setup();
    repo.insert(makeEvent({ status: 200 }));
    repo.insert(makeEvent({ status: 500 }));
    repo.insert(makeEvent({ status: null }));
    expect(repo.list({ status: 'ok' }).rows.length).toBe(1);
    expect(repo.list({ status: 'error' }).rows.length).toBe(2);
  });

  it('count and countSince', () => {
    const repo = setup();
    const t = Date.now();
    repo.insert(makeEvent({ ts_start: t - 200_000 }));
    repo.insert(makeEvent({ ts_start: t }));
    expect(repo.count()).toBe(2);
    expect(repo.countSince(t - 1000)).toBe(1);
  });

  it('FTS search tolerates special characters that would otherwise crash MATCH', () => {
    const repo = setup();
    repo.insert(makeEvent({ request_body: 'about hummingbirds' }));
    // None of these should throw — the escape wraps as a phrase.
    expect(() => repo.list({ q: '*' })).not.toThrow();
    expect(() => repo.list({ q: '"trailing-quote' })).not.toThrow();
    expect(() => repo.list({ q: 'open(paren' })).not.toThrow();
    expect(() => repo.list({ q: 'colon:in:query' })).not.toThrow();
    // And a real query still finds the row.
    expect(repo.list({ q: 'hummingbirds' }).rows.length).toBe(1);
    expect(repo.list({ q: 'hummingbird*' }).rows.length).toBe(1);
  });
});
