import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { migrate } from '../src/db/migrate';
import { processIngest } from '../src/ingest/pipeline';
import { EventsRepo } from '../src/db/events-repo';
import { SourcesRepo } from '../src/db/sources-repo';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  const events = new EventsRepo(db);
  const sources = new SourcesRepo(db);
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
  return { app, events, sources };
}

const auth = { authorization: 'Bearer t' };

describe('GET /api/events/:id', () => {
  it('returns full row + parsed headers for an existing event', async () => {
    const { app, events, sources } = setup();
    const r = processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
      ts_start: 1, ts_end: 2, transport: 'http', method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0' },
      request_body: '{"model":"gpt-4o","messages":[]}',
      status: 200,
      response_headers: { 'content-type': 'application/json' },
      response_body: '{}',
    });
    const res = await app.request(`/api/events/${r.id}`, { headers: auth });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { id: string; request_headers: Record<string, string>; response_headers: Record<string, string> };
    expect(j.id).toBe(r.id);
    expect(j.request_headers['user-agent']).toBe('OpenAI/Codex-CLI 1.0');
    expect(j.response_headers['content-type']).toBe('application/json');
  });

  it('returns 404 for unknown id', async () => {
    const { app } = setup();
    const r = await app.request('/api/events/evt_NOTEXIST', { headers: auth });
    expect(r.status).toBe(404);
  });
});
