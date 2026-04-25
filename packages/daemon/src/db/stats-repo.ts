import type { Database } from 'bun:sqlite';

export type Bucket = 'hour' | 'day' | 'week';
export type GroupBy = 'provider' | 'source_kind' | 'model';

const BUCKET_FORMAT: Record<Bucket, string> = {
  hour: '%Y-%m-%dT%H:00:00Z',
  day: '%Y-%m-%d',
  week: '%Y-%W',
};

export interface StatsRow {
  bucket: string;
  group_value: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  request_count: number;
}

export class StatsRepo {
  constructor(private db: Database) {}

  series(opts: { sinceMs: number; untilMs: number; bucket: Bucket; groupBy: GroupBy }): StatsRow[] {
    const fmt = BUCKET_FORMAT[opts.bucket];
    const groupCol = opts.groupBy === 'model' ? "COALESCE(model, '∅')" : opts.groupBy;
    const sql = `
      SELECT strftime('${fmt}', ts_start / 1000, 'unixepoch') AS bucket,
             ${groupCol} AS group_value,
             COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
             COALESCE(SUM(total_tokens), 0) AS total_tokens,
             COUNT(*) AS request_count
        FROM events
       WHERE ts_start BETWEEN ? AND ?
       GROUP BY bucket, group_value
       ORDER BY bucket ASC
    `;
    return this.db.query<StatsRow, [number, number]>(sql).all(opts.sinceMs, opts.untilMs) as StatsRow[];
  }

  totals(opts: { sinceMs: number; untilMs: number }): {
    request_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    distinct_models: string[];
  } {
    const sums = this.db
      .query<
        { request_count: number; prompt_tokens: number; completion_tokens: number; total_tokens: number },
        [number, number]
      >(
        `SELECT COUNT(*) AS request_count,
                COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
                COALESCE(SUM(completion_tokens),0) AS completion_tokens,
                COALESCE(SUM(total_tokens),0) AS total_tokens
         FROM events WHERE ts_start BETWEEN ? AND ?`,
      )
      .get(opts.sinceMs, opts.untilMs);
    const models = this.db
      .query<{ model: string | null }, [number, number]>(
        'SELECT DISTINCT model FROM events WHERE ts_start BETWEEN ? AND ? AND model IS NOT NULL',
      )
      .all(opts.sinceMs, opts.untilMs) as { model: string | null }[];
    return {
      ...(sums ?? { request_count: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      distinct_models: models.map((m) => m.model!).filter(Boolean),
    };
  }

  perModelTokens(opts: { sinceMs: number; untilMs: number }): { model: string; prompt: number; completion: number }[] {
    return this.db
      .query<{ model: string; prompt: number; completion: number }, [number, number]>(
        `SELECT model AS model, COALESCE(SUM(prompt_tokens),0) AS prompt, COALESCE(SUM(completion_tokens),0) AS completion
         FROM events WHERE ts_start BETWEEN ? AND ? AND model IS NOT NULL GROUP BY model`,
      )
      .all(opts.sinceMs, opts.untilMs) as { model: string; prompt: number; completion: number }[];
  }
}
