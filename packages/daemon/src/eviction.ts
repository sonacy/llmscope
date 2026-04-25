import type { Database } from 'bun:sqlite';
import { statSync } from 'node:fs';
import type { Broadcaster } from './broadcaster';

export interface EvictionDeps {
  db: Database;
  dbPath: string;
  capBytes: number;
  broadcaster?: Broadcaster;
  log?: (msg: string) => void;
}

export function dbSizeBytes(dbPath: string): number {
  if (dbPath === ':memory:') return 0;
  try {
    return statSync(dbPath).size;
  } catch {
    return 0;
  }
}

export function evictOldestUntilUnderCap(deps: EvictionDeps): { evicted: number } {
  const targetBytes = Math.floor(deps.capBytes * 0.9);
  // Strategy: estimate per-event bytes, delete enough oldest rows to reach
  // the target, then VACUUM once to reclaim the file space. Doing VACUUM
  // inside the loop would be O(n) cascading work; doing it once is enough.
  const sizeBefore = dbSizeBytes(deps.dbPath);
  if (sizeBefore <= deps.capBytes) return { evicted: 0 };
  const total = deps.db.query<{ c: number }, []>('SELECT COUNT(*) as c FROM events').get();
  const totalRows = total?.c ?? 0;
  if (totalRows === 0) return { evicted: 0 };
  const bytesPerRow = sizeBefore / totalRows;
  const overage = sizeBefore - targetBytes;
  const rowsToDelete = Math.min(totalRows, Math.ceil(overage / Math.max(bytesPerRow, 1)));
  const beforeCount = totalRows;
  deps.db
    .prepare('DELETE FROM events WHERE rowid IN (SELECT rowid FROM events ORDER BY ts_start ASC LIMIT ?)')
    .run(rowsToDelete);
  const after = deps.db.query<{ c: number }, []>('SELECT COUNT(*) as c FROM events').get();
  const evicted = beforeCount - (after?.c ?? 0);
  if (evicted > 0) {
    deps.log?.(`llmscope: evicted ${evicted} oldest events to stay under cap`);
    deps.db.run('PRAGMA wal_checkpoint(TRUNCATE)');
    deps.db.run('VACUUM');
    deps.broadcaster?.publish({ kind: 'stats_invalidate' });
  }
  return { evicted };
}

export function startEvictionTicker(deps: EvictionDeps, intervalMs = 5 * 60 * 1000): { stop: () => void } {
  const handle = setInterval(() => {
    if (dbSizeBytes(deps.dbPath) > deps.capBytes) {
      evictOldestUntilUnderCap(deps);
    }
  }, intervalMs);
  return { stop: () => clearInterval(handle) };
}
