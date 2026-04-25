import type { MiddlewareHandler } from 'hono';

const ALLOWED_HOSTS = ['127.0.0.1', 'localhost'];
const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'authorization, content-type';

function isAllowed(origin: string): boolean {
  try {
    const u = new URL(origin);
    return ALLOWED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function corsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && isAllowed(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Vary', 'Origin');
    }
    if (c.req.method === 'OPTIONS') {
      if (!origin || !isAllowed(origin)) return c.body(null, 403);
      c.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
      c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }
    return next();
  };
}
