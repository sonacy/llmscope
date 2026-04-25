import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from 'bun:sqlite';
import type { EventsRepo } from '../db/events-repo';
import type { SourcesRepo } from '../db/sources-repo';
import type { Broadcaster } from '../broadcaster';
import { applyRuleToRecentEvents } from '../ingest/apply-rule';

const SourceRuleSchema = z.object({
  match_type: z.enum(['ua_exact', 'ua_prefix', 'ua_regex', 'host', 'shape']),
  pattern: z.string().min(1),
  kind: z.string().min(1),
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export interface SourcesRouteDeps {
  db: Database;
  events: EventsRepo;
  sources: SourcesRepo;
  broadcaster: Broadcaster;
}

export function sourcesRoute(deps: SourcesRouteDeps): Hono {
  const r = new Hono();

  r.get('/', (c) => {
    const split = deps.sources.splitByOrigin();
    return c.json(split);
  });

  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = SourceRuleSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid rule', details: parsed.error.issues }, 400);
    try {
      const row = deps.sources.insertUserRule(parsed.data);
      return c.json(row, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'insert failed';
      return c.json({ error: msg }, 409);
    }
  });

  r.delete('/:id', (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);
    const existing = deps.sources.getById(id);
    if (!existing) return c.json({ error: 'not found' }, 404);
    if (!existing.user_defined) return c.json({ error: 'cannot delete built-in rule' }, 403);
    deps.sources.deleteUserRule(id);
    return c.json({ ok: true });
  });

  r.post('/:id/apply', (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);
    const rule = deps.sources.getById(id);
    if (!rule) return c.json({ error: 'not found' }, 404);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const r = applyRuleToRecentEvents(deps.db, deps.events, rule, sevenDaysAgo, deps.broadcaster);
    return c.json(r);
  });

  return r;
}
