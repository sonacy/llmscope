import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../../packages/daemon/src/db/migrate';
import { processIngest } from '../../packages/daemon/src/ingest/pipeline';
import { EventsRepo } from '../../packages/daemon/src/db/events-repo';
import { SourcesRepo } from '../../packages/daemon/src/db/sources-repo';

describe('ingest perf', () => {
  it('processes 1000 events in under 2s (in-memory DB)', () => {
    const db = new Database(':memory:');
    migrate(db);
    const events = new EventsRepo(db);
    const sources = new SourcesRepo(db);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
        ts_start: 1000 + i, ts_end: 1100 + i, transport: 'http', method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0' },
        request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}',
        status: 200, response_headers: {}, response_body: '{"choices":[{"message":{"content":"hello"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}',
      });
    }
    const t1 = performance.now();
    const ms = t1 - t0;
    expect(events.count()).toBe(1000);
    expect(ms).toBeLessThan(2000);
  });
});

describe('FTS5 search perf', () => {
  it('full-text search across 1000 events stays under 50ms', () => {
    const db = new Database(':memory:');
    migrate(db);
    const events = new EventsRepo(db);
    const sources = new SourcesRepo(db);
    for (let i = 0; i < 1000; i++) {
      processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
        ts_start: 1000 + i, ts_end: 1100 + i, transport: 'http', method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0' },
        request_body: `{"model":"gpt-4o","messages":[{"role":"user","content":"refactor module ${i}"}]}`,
        status: 200, response_headers: {}, response_body: '{}',
      });
    }
    const t0 = performance.now();
    const r = events.list({ q: 'refactor', limit: 50 });
    const ms = performance.now() - t0;
    expect(r.rows.length).toBe(50);
    expect(ms).toBeLessThan(50);
  });
});
