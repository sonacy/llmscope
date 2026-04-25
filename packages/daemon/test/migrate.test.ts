import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate, currentVersion, seedFingerprints } from '../src/db/migrate';
import { probeFts5 } from '../src/db/connect';

function memDb(): Database {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys=ON');
  return db;
}

describe('migrate', () => {
  it('FTS5 is available', () => {
    expect(probeFts5(memDb())).toBe(true);
  });

  it('creates all tables and indexes', () => {
    const db = memDb();
    migrate(db);
    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('events');
    expect(names).toContain('events_fts');
    expect(names).toContain('source_fingerprints');
    expect(names).toContain('replays');
    expect(names).toContain('meta');
    expect(currentVersion(db)).toBeGreaterThanOrEqual(1);
  });

  it('seeds built-in fingerprints additively (INSERT OR IGNORE)', () => {
    const db = memDb();
    migrate(db);
    const a = db.query<{ c: number }, []>('SELECT count(*) as c FROM source_fingerprints WHERE user_defined=0').get() as {
      c: number;
    };
    expect(a.c).toBeGreaterThan(5);
    seedFingerprints(db);
    const b = db.query<{ c: number }, []>('SELECT count(*) as c FROM source_fingerprints WHERE user_defined=0').get() as {
      c: number;
    };
    expect(b.c).toBe(a.c);
  });

  it('preserves user-defined rows when seeding built-ins', () => {
    const db = memDb();
    migrate(db);
    db.run(
      'INSERT INTO source_fingerprints(match_type, pattern, kind, label, confidence, user_defined) VALUES (?, ?, ?, ?, ?, 1)',
      ['ua_prefix', 'my-app/', 'my-app', 'My App', 1.0] as any,
    );
    seedFingerprints(db);
    const row = db
      .query<{ c: number }, []>("SELECT count(*) as c FROM source_fingerprints WHERE user_defined=1 AND pattern='my-app/'")
      .get() as { c: number };
    expect(row.c).toBe(1);
  });

  it('is idempotent', () => {
    const db = memDb();
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });
});
