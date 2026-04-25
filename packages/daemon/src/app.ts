import { Hono } from 'hono';
import type { Config } from './config';

export interface AppDeps {
  config: Config;
  startedAt: number;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      version: '0.0.0',
      started_at: deps.startedAt,
      uptime_ms: Date.now() - deps.startedAt,
      db_size_bytes: 0,
      events_today: 0,
    });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));

  return app;
}
