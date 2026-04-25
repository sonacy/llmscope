import { describe, it, expect } from 'bun:test';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureToken, rotateToken } from '../src/auth';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

describe('ensureToken', () => {
  it('creates a token file with mode 0600', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-auth-'));
    const path = join(dir, 'token');
    const t = ensureToken(path);
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(readFileSync(path, 'utf8').trim()).toBe(t);
    const st = statSync(path);
    expect(st.mode & 0o777).toBe(0o600);
  });

  it('reuses existing token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-auth-'));
    const path = join(dir, 'token');
    const a = ensureToken(path);
    const b = ensureToken(path);
    expect(a).toBe(b);
  });

  it('rotates produces a new token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-auth-'));
    const path = join(dir, 'token');
    const a = ensureToken(path);
    const b = rotateToken(path);
    expect(a).not.toBe(b);
  });
});

describe('bearerAuth middleware', () => {
  const cfg = loadConfig({});
  const token = 'tok-' + 'a'.repeat(32);
  const app = createApp({ config: cfg, startedAt: Date.now(), token });

  it('rejects /api/* without bearer', async () => {
    const res = await app.request('/api/events');
    expect(res.status).toBe(401);
  });

  it('rejects wrong bearer', async () => {
    const res = await app.request('/api/events', { headers: { authorization: 'Bearer wrong' } });
    expect(res.status).toBe(401);
  });

  it('lets /api/health through without bearer', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });
});
