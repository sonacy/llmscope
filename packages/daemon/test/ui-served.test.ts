import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { migrate } from '../src/db/migrate';

describe('static UI route', () => {
  it('serves index.html at "/" when public dir exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-ui-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>llmscope</title>');
    process.env.LLMSCOPE_PUBLIC_DIR = dir;
    const db = new Database(':memory:');
    migrate(db);
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
    const r = await app.request('/');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type') ?? '').toContain('text/html');
    const body = await r.text();
    expect(body).toContain('llmscope');
    delete process.env.LLMSCOPE_PUBLIC_DIR;
  });

  it('SPA fallback: unknown non-/api path returns index.html', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-ui-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');
    process.env.LLMSCOPE_PUBLIC_DIR = dir;
    const db = new Database(':memory:');
    migrate(db);
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db });
    const r = await app.request('/events/abc');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('spa');
    delete process.env.LLMSCOPE_PUBLIC_DIR;
  });
});
