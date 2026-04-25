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

// Backoff cap: if VACUUM keeps failing to reclaim file pages (a known
// bun:sqlite + FTS5 quirk on some platforms), don't retry forever.
const NOOP_VACUUM_MAX = 3;

export function startEvictionTicker(deps: EvictionDeps, intervalMs = 5 * 60 * 1000): { stop: () => void } {
  let consecutiveNoops = 0;
  let backedOff = false;
  const handle = setInterval(() => {
    if (backedOff) return;
    const before = dbSizeBytes(deps.dbPath);
    if (before <= deps.capBytes) {
      consecutiveNoops = 0;
      return;
    }
    evictOldestUntilUnderCap(deps);
    const after = dbSizeBytes(deps.dbPath);
    if (after >= before) {
      consecutiveNoops++;
      if (consecutiveNoops >= NOOP_VACUUM_MAX) {
        deps.log?.(
          `llmscope: eviction ticker backing off after ${NOOP_VACUUM_MAX} consecutive no-op VACUUMs (DB at ${after} bytes, cap ${deps.capBytes}); restart daemon to retry`,
        );
        backedOff = true;
      }
    } else {
      consecutiveNoops = 0;
    }
  }, intervalMs);
  return { stop: () => clearInterval(handle) };
}
