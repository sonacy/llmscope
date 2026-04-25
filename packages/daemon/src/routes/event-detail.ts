import { Hono } from 'hono';
import type { EventsRepo } from '../db/events-repo';

export function eventDetailRoute(events: EventsRepo): Hono {
  const r = new Hono();
  r.get('/:id', (c) => {
    const id = c.req.param('id');
    const row = events.getById(id);
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({
      ...row,
      request_headers: safeParse(row.request_headers),
      response_headers: safeParse(row.response_headers),
      reassembled_meta: row.reassembled_meta ? safeParse(row.reassembled_meta) : null,
      request_body_truncated: row.request_body_truncated === 1,
      response_body_truncated: row.response_body_truncated === 1,
    });
  });
  return r;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
