import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA foreign_keys=ON');
  db.run('PRAGMA temp_store=MEMORY');
  return db;
}

export function probeFts5(db: Database): boolean {
  try {
    db.run('CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_probe USING fts5(x)');
    db.run('DROP TABLE _fts5_probe');
    return true;
  } catch {
    return false;
  }
}
