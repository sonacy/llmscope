import { Hono } from 'hono';
import type { EventsRepo } from '../db/events-repo';
import type { SourcesRepo } from '../db/sources-repo';
import type { Broadcaster } from '../broadcaster';
import { processIngest } from '../ingest/pipeline';

export interface IngestRouteDeps {
  events: EventsRepo;
  sources: SourcesRepo;
  broadcaster: Broadcaster;
  bodyCapBytes: number;
}

export function ingestRoute(deps: IngestRouteDeps): Hono {
  const r = new Hono();
  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    try {
      const result = processIngest(
        { events: deps.events, sources: deps.sources, bodyCapBytes: deps.bodyCapBytes },
        body,
      );
      deps.broadcaster.publish({ kind: 'event_new', id: result.id });
      return c.json(result, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ingest failed';
      return c.json({ error: msg }, 400);
    }
  });
  return r;
}
