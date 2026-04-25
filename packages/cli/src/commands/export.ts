import { readFileSync } from 'node:fs';
import { loadPaths, defaultPort } from '../paths';

export interface ExportOptions {
  since?: string;
  until?: string;
  source?: string;
  provider?: string;
  format?: 'jsonl';
  out?: NodeJS.WritableStream;
}

function readToken(): string {
  if (process.env.LLMSCOPE_TOKEN) return process.env.LLMSCOPE_TOKEN.trim();
  const paths = loadPaths();
  return readFileSync(paths.tokenPath, 'utf8').trim();
}

function isoToMs(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function runExport(opts: ExportOptions = {}): Promise<{ count: number }> {
  const out = opts.out ?? process.stdout;
  const token = readToken();
  const port = defaultPort();
  const since = isoToMs(opts.since);
  const until = isoToMs(opts.until);
  let cursor: string | null = null;
  let count = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('limit', '500');
    if (cursor) params.set('cursor', cursor);
    if (since != null) params.set('since', String(since));
    if (until != null) params.set('until', String(until));
    if (opts.source) params.set('source', opts.source);
    if (opts.provider) params.set('provider', opts.provider);
    const url = `http://127.0.0.1:${port}/api/events?${params.toString()}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`export: daemon returned ${res.status}`);
    const j = (await res.json()) as { events: unknown[]; next_cursor: string | null };
    for (const e of j.events) {
      out.write(JSON.stringify(e) + '\n');
      count++;
    }
    if (!j.next_cursor) break;
    cursor = j.next_cursor;
  }
  return { count };
}
