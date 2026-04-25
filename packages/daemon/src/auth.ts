import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export function ensureToken(tokenPath: string): string {
  if (existsSync(tokenPath)) {
    const t = readFileSync(tokenPath, 'utf8').trim();
    if (t.length >= 32) return t;
  }
  const dir = dirname(tokenPath);
  mkdirSync(dir, { recursive: true });
  const tok = randomBytes(32).toString('hex');
  writeFileSync(tokenPath, tok + '\n', { mode: 0o600 });
  try {
    chmodSync(tokenPath, 0o600);
  } catch {
    // best effort
  }
  return tok;
}

export function rotateToken(tokenPath: string): string {
  const tok = randomBytes(32).toString('hex');
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, tok + '\n', { mode: 0o600 });
  try {
    chmodSync(tokenPath, 0o600);
  } catch {
    /* */
  }
  return tok;
}

export interface BearerOptions {
  expected: () => string;
  bypass?: (path: string) => boolean;
}

export function bearerAuth(opts: BearerOptions): MiddlewareHandler {
  return async (c, next) => {
    if (opts.bypass?.(new URL(c.req.url).pathname)) return next();
    const h = c.req.header('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m || m[1] !== opts.expected()) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  };
}
