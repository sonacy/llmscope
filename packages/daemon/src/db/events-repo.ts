import type { Database } from 'bun:sqlite';

export interface EventRow {
  id: string;
  ts_start: number;
  ts_end: number;
  transport: 'http' | 'sse' | 'ws';
  method: string;
  url: string;
  host: string;
  status: number | null;
  source_kind: string;
  source_label: string;
  source_confidence: number;
  provider: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number;
  request_headers: string;
  response_headers: string;
  request_body: string | null;
  response_body: string | null;
  request_body_truncated: number;
  response_body_truncated: number;
  reassembled_meta: string | null;
  error: string | null;
  parent_id: string | null;
  created_at: number;
}

const COLUMNS: readonly (keyof EventRow)[] = [
  'id',
  'ts_start',
  'ts_end',
  'transport',
  'method',
  'url',
  'host',
  'status',
  'source_kind',
  'source_label',
  'source_confidence',
  'provider',
  'model',
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'cost_usd',
  'latency_ms',
  'request_headers',
  'response_headers',
  'request_body',
  'response_body',
  'request_body_truncated',
  'response_body_truncated',
  'reassembled_meta',
  'error',
  'parent_id',
];

const PLACEHOLDERS = COLUMNS.map(() => '?').join(', ');
const COLUMN_LIST = COLUMNS.join(', ');

export interface ListFilters {
  source?: string;
  provider?: string;
  model?: string;
  status?: 'ok' | 'error';
  q?: string;
  since?: number;
  until?: number;
  cursor?: string;
  limit?: number;
}

export class EventsRepo {
  private insertStmt: ReturnType<Database['prepare']>;
  constructor(private db: Database) {
    this.insertStmt = db.prepare(`INSERT INTO events(${COLUMN_LIST}) VALUES (${PLACEHOLDERS})`);
  }

  insert(e: Omit<EventRow, 'created_at'>): void {
    const params = COLUMNS.map((c) => (e as Record<string, unknown>)[c] ?? null);
    this.insertStmt.run(...(params as never[]));
  }

  getById(id: string): EventRow | null {
    return (
      this.db
        .query<EventRow, [string]>(`SELECT ${COLUMN_LIST}, created_at FROM events WHERE id = ?`)
        .get(id) ?? null
    );
  }

  list(f: ListFilters = {}): { rows: EventRow[]; nextCursor: string | null } {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (f.source) {
      where.push('source_kind = ?');
      params.push(f.source);
    }
    if (f.provider) {
      where.push('provider = ?');
      params.push(f.provider);
    }
    if (f.model) {
      where.push('model = ?');
      params.push(f.model);
    }
    if (f.status === 'ok') where.push('(status >= 200 AND status < 400)');
    if (f.status === 'error') where.push('(status IS NULL OR status >= 400)');
    if (f.since != null) {
      where.push('ts_start >= ?');
      params.push(f.since);
    }
    if (f.until != null) {
      where.push('ts_start <= ?');
      params.push(f.until);
    }
    if (f.cursor) {
      where.push('id < ?');
      params.push(f.cursor);
    }
    if (f.q) {
      where.push('rowid IN (SELECT rowid FROM events_fts WHERE events_fts MATCH ?)');
      params.push(f.q);
    }
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 500);
    const sql = `SELECT ${COLUMN_LIST}, created_at FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
    const allParams = [...params, limit + 1] as never[];
    const rows = this.db.query<EventRow, never[]>(sql).all(...allParams) as EventRow[];
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      nextCursor = rows[limit - 1]!.id;
      rows.length = limit;
    }
    return { rows, nextCursor };
  }

  count(): number {
    const r = this.db.query<{ c: number }, []>('SELECT count(*) as c FROM events').get();
    return r?.c ?? 0;
  }

  countSince(tsMs: number): number {
    const r = this.db
      .query<{ c: number }, [number]>('SELECT count(*) as c FROM events WHERE ts_start >= ?')
      .get(tsMs);
    return r?.c ?? 0;
  }
}
