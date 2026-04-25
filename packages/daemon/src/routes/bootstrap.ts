import { Hono } from 'hono';

export interface BootstrapDeps {
  port: number;
  token: string;
  version: string;
}

const ALLOWED_HOSTS = ['127.0.0.1', 'localhost'];

export function bootstrapRoute(deps: BootstrapDeps): Hono {
  const r = new Hono();
  r.get('/', (c) => {
    const origin = c.req.header('origin');
    if (origin) {
      try {
        const u = new URL(origin);
        if (!ALLOWED_HOSTS.includes(u.hostname)) return c.json({ error: 'forbidden' }, 403);
      } catch {
        return c.json({ error: 'forbidden' }, 403);
      }
    }
    return c.json({ port: deps.port, version: deps.version, token: deps.token });
  });
  return r;
}
