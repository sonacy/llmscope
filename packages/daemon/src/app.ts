import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { statSync } from 'node:fs';
import type { Config } from './config';
import { bearerAuth } from './auth';
import { EventsRepo } from './db/events-repo';
import { SourcesRepo } from './db/sources-repo';
import { ingestRoute } from './routes/ingest';
import { eventsListRoute } from './routes/events-list';
import { eventDetailRoute } from './routes/event-detail';
import { statsRoute } from './routes/stats';
import { StatsRepo } from './db/stats-repo';
import { replayRoute } from './routes/replay';
import { ReplaysRepo } from './db/replays-repo';
import type { Broadcaster } from './broadcaster';
import { StubBroadcaster } from './broadcaster';

export interface AppDeps {
  config: Config;
  startedAt: number;
  token: string;
  db: Database;
  broadcaster?: Broadcaster;
  fetchImpl?: typeof fetch;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const events = new EventsRepo(deps.db);
  const sources = new SourcesRepo(deps.db);
  const broadcaster = deps.broadcaster ?? new StubBroadcaster();

  app.use(
    '/api/*',
    bearerAuth({
      expected: () => deps.token,
      bypass: (p) => p === '/api/health' || p === '/api/_bootstrap',
    }),
  );

  app.get('/api/health', (c) => {
    let dbBytes = 0;
    try {
      if (deps.config.dbPath !== ':memory:') dbBytes = statSync(deps.config.dbPath).size;
    } catch {
      /* */
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return c.json({
      ok: true,
      version: '0.0.0',
      started_at: deps.startedAt,
      uptime_ms: Date.now() - deps.startedAt,
      db_size_bytes: dbBytes,
      events_today: events.countSince(startOfDay.getTime()),
      events_total: events.count(),
    });
  });

  app.route('/api/ingest', ingestRoute({ events, sources, broadcaster, bodyCapBytes: deps.config.bodyCapBytes }));
  app.route('/api/events', eventsListRoute(events));
  app.route('/api/events', eventDetailRoute(events));
  app.route('/api/stats', statsRoute(new StatsRepo(deps.db)));
  app.route(
    '/api/events',
    replayRoute({
      events,
      sources,
      replays: new ReplaysRepo(deps.db),
      broadcaster,
      bodyCapBytes: deps.config.bodyCapBytes,
      fetchImpl: deps.fetchImpl,
    }),
  );

  app.notFound((c) => c.json({ error: 'not found' }, 404));

  return app;
}
