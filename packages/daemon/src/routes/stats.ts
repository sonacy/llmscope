import { Hono } from 'hono';
import { z } from 'zod';
import { costUsd } from '@llmscope/core';
import { StatsRepo, type Bucket, type GroupBy } from '../db/stats-repo';

const RANGE_TO_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

const QuerySchema = z.object({
  range: z.enum(['1h', '24h', '7d', '30d', '90d']).default('7d'),
  bucket: z.enum(['hour', 'day', 'week']).default('day'),
  groupBy: z.enum(['provider', 'source_kind', 'model']).default('provider'),
});

export function statsRoute(repo: StatsRepo): Hono {
  const r = new Hono();
  r.get('/', (c) => {
    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams.entries()));
    if (!parsed.success) return c.json({ error: 'invalid query', details: parsed.error.issues }, 400);
    const { range, bucket, groupBy } = parsed.data;

    const now = Date.now();
    const sinceMs = now - RANGE_TO_MS[range]!;
    const series = repo.series({ sinceMs, untilMs: now, bucket: bucket as Bucket, groupBy: groupBy as GroupBy });
    const totals = repo.totals({ sinceMs, untilMs: now });
    const perModel = repo.perModelTokens({ sinceMs, untilMs: now });

    const unpriced: string[] = [];
    let totalCost = 0;
    for (const m of perModel) {
      const c = costUsd(m.model, m.prompt, m.completion);
      if (c == null) unpriced.push(m.model);
      else totalCost += c;
    }

    return c.json({
      range,
      bucket,
      groupBy,
      since_ms: sinceMs,
      until_ms: now,
      series,
      totals: {
        request_count: totals.request_count,
        prompt_tokens: totals.prompt_tokens,
        completion_tokens: totals.completion_tokens,
        total_tokens: totals.total_tokens,
        cost_usd: totalCost,
        unpriced_models: unpriced,
      },
    });
  });
  return r;
}
