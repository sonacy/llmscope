import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../src/db/migrate';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  return createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
}

const auth = { authorization: 'Bearer t' };

describe('CORS + bootstrap', () => {
  it('preflight from allowed origin returns 204 with allow headers', async () => {
    const app = setup();
    const r = await app.request('/api/events', {
      method: 'OPTIONS',
      headers: { origin: 'http://127.0.0.1:47821', 'access-control-request-method': 'GET' },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:47821');
    expect(r.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('preflight from foreign origin is forbidden', async () => {
    const app = setup();
    const r = await app.request('/api/events', {
      method: 'OPTIONS',
      headers: { origin: 'http://evil.example.com', 'access-control-request-method': 'GET' },
    });
    expect(r.status).toBe(403);
  });

  it('GET /api/_bootstrap from allowed origin returns token (no bearer needed)', async () => {
    const app = setup();
    const r = await app.request('/api/_bootstrap', { headers: { origin: 'http://localhost:47821' } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { token: string; port: number; version: string };
    expect(j.token).toBe('t');
  });

  it('bootstrap from foreign origin is forbidden', async () => {
    const app = setup();
    const r = await app.request('/api/_bootstrap', { headers: { origin: 'http://evil.example.com' } });
    expect(r.status).toBe(403);
  });

  it('GET request from allowed origin includes ACAO header', async () => {
    const app = setup();
    const r = await app.request('/api/events', { headers: { ...auth, origin: 'http://localhost:47821' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:47821');
  });
});
