import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

describe('GET /api/health', () => {
  it('returns ok with version and uptime', async () => {
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't' });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; version: string; uptime_ms: number };
    expect(json.ok).toBe(true);
    expect(typeof json.version).toBe('string');
    expect(json.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for unknown non-/api routes', async () => {
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't' });
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
  });
});

describe('loadConfig', () => {
  it('defaults to 127.0.0.1 and a fixed port', () => {
    const c = loadConfig({});
    expect(c.host).toBe('127.0.0.1');
    expect(c.port).toBe(47821);
  });

  it('respects env overrides', () => {
    const c = loadConfig({ LLMSCOPE_HOST: '127.0.0.1', LLMSCOPE_PORT: '5000' });
    expect(c.port).toBe(5000);
  });
});
