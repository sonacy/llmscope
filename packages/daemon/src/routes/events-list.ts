import { Hono } from 'hono';
import { z } from 'zod';
import type { EventsRepo } from '../db/events-repo';
import { toSummary } from '../transform/summary';

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  source: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  status: z.enum(['ok', 'error']).optional(),
  q: z.string().optional(),
  since: z.coerce.number().int().optional(),
  until: z.coerce.number().int().optional(),
});

export function eventsListRoute(events: EventsRepo): Hono {
  const r = new Hono();
  r.get('/', (c) => {
    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams.entries()));
    if (!parsed.success) return c.json({ error: 'invalid query', details: parsed.error.issues }, 400);
    const { rows, nextCursor } = events.list(parsed.data);
    return c.json({ events: rows.map(toSummary), next_cursor: nextCursor });
  });
  return r;
}
