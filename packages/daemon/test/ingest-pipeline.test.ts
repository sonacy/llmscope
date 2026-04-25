import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../src/db/migrate';
import { EventsRepo } from '../src/db/events-repo';
import { SourcesRepo } from '../src/db/sources-repo';
import { processIngest } from '../src/ingest/pipeline';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  return {
    db,
    events: new EventsRepo(db),
    sources: new SourcesRepo(db),
    bodyCapBytes: 1024 * 1024,
  };
}

const baseRaw = {
  ts_start: 1714032000000,
  ts_end: 1714032001500,
  transport: 'http' as const,
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  request_headers: {
    'content-type': 'application/json',
    'user-agent': 'OpenAI/Codex-CLI 0.5',
    authorization: 'Bearer sk-leak',
  },
  request_body: '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}',
  status: 200,
  response_headers: { 'content-type': 'application/json' },
  response_body: '{"choices":[{"message":{"content":"hello"}}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}',
};

describe('processIngest', () => {
  it('inserts an event with derived provider/source/cost', () => {
    const deps = setup();
    const r = processIngest(deps, baseRaw);
    expect(r.provider).toBe('openai');
    expect(r.source_kind).toBe('codex');

    const got = deps.events.getById(r.id)!;
    expect(got.model).toBe('gpt-4o-mini');
    expect(got.prompt_tokens).toBe(2);
    expect(got.total_tokens).toBe(3);
    expect(got.cost_usd).not.toBeNull();
    expect(got.latency_ms).toBe(1500);
  });

  it('re-masks Authorization in stored request_headers', () => {
    const deps = setup();
    const r = processIngest(deps, baseRaw);
    const got = deps.events.getById(r.id)!;
    expect(got.request_headers).not.toContain('sk-leak');
    expect(got.request_headers).toContain('***MASKED***');
  });

  it('falls back to unknown source on truly unknown UA', () => {
    const deps = setup();
    const r = processIngest(deps, {
      ...baseRaw,
      request_headers: { ...baseRaw.request_headers, 'user-agent': 'totally-unknown' },
    });
    expect(r.source_kind).toBe('unknown');
  });

  it('a freshly inserted user fingerprint applies on next ingest (no cache)', () => {
    const deps = setup();
    deps.sources.insertUserRule({
      match_type: 'ua_prefix',
      pattern: 'totally-unknown',
      kind: 'my-kind',
      label: 'My Kind',
      confidence: 0.99,
    });
    const r = processIngest(deps, {
      ...baseRaw,
      request_headers: { ...baseRaw.request_headers, 'user-agent': 'totally-unknown-1.0' },
    });
    expect(r.source_kind).toBe('my-kind');
  });
});
