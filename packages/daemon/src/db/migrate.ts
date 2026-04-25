import type { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeFts5 } from './connect';
import { BUILTIN_FINGERPRINTS } from '@llmscope/core';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, 'migrations');

export function currentVersion(db: Database): number {
  db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = db.query<{ value: string }, [string]>('SELECT value FROM meta WHERE key = ?').get('schema_version');
  return row ? Number(row.value) : 0;
}

export function migrate(db: Database, dir = MIGRATIONS_DIR): number {
  if (!probeFts5(db)) {
    throw new Error('llmscope: SQLite FTS5 not available — bun:sqlite was built without it. See risk R2 in plan.');
  }
  const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const start = currentVersion(db);
  for (const f of files) {
    const v = Number(f.slice(0, 4));
    if (v <= start) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    db.transaction(() => {
      db.run(sql);
      db.run(
        'INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        ['schema_version', String(v)],
      );
    })();
  }
  seedFingerprints(db);
  return currentVersion(db);
}

export function seedFingerprints(db: Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO source_fingerprints(match_type, pattern, kind, label, confidence, user_defined) VALUES (?, ?, ?, ?, ?, 0)',
  );
  db.transaction(() => {
    for (const fp of BUILTIN_FINGERPRINTS) {
      insert.run(fp.match_type, fp.pattern, fp.kind, fp.label, fp.confidence);
    }
  })();
}
