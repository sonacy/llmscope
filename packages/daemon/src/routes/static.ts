import { Hono } from 'hono';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

export function staticRoute(rootDir: string): Hono {
  const r = new Hono();
  const root = resolve(rootDir);
  r.get('*', (c) => {
    const url = new URL(c.req.url);
    if (url.pathname.startsWith('/api/')) return c.notFound();
    let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    pathname = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, pathname);
    if (!filePath.startsWith(root)) return c.notFound();
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      // SPA fallback to index.html
      filePath = join(root, 'index.html');
      if (!existsSync(filePath)) return c.notFound();
    }
    const body = readFileSync(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    return new Response(body, { headers: { 'content-type': mime } });
  });
  return r;
}
