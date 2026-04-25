import type { Database } from 'bun:sqlite';
import type { Fingerprint } from '@llmscope/core';

export interface FingerprintRow extends Fingerprint {
  id: number;
  created_at: number;
}

export class SourcesRepo {
  constructor(private db: Database) {}

  // Read fresh on every call — no in-memory cache, so user-defined rules
  // added via POST /api/sources take effect on the very next ingest.
  loadAll(): FingerprintRow[] {
    return this.db
      .query<FingerprintRow, []>(
        'SELECT id, match_type, pattern, kind, label, confidence, user_defined, created_at FROM source_fingerprints ORDER BY user_defined DESC, id ASC',
      )
      .all() as FingerprintRow[];
  }

  insertUserRule(rule: Omit<Fingerprint, 'user_defined'>): FingerprintRow {
    this.db
      .prepare(
        'INSERT INTO source_fingerprints(match_type, pattern, kind, label, confidence, user_defined) VALUES (?, ?, ?, ?, ?, 1)',
      )
      .run(rule.match_type, rule.pattern, rule.kind, rule.label, rule.confidence);
    const row = this.db
      .query<FingerprintRow, []>(
        'SELECT id, match_type, pattern, kind, label, confidence, user_defined, created_at FROM source_fingerprints WHERE id = last_insert_rowid()',
      )
      .get();
    if (!row) throw new Error('insertUserRule: failed to read back row');
    return row;
  }

  deleteUserRule(id: number): boolean {
    const r = this.db.prepare('DELETE FROM source_fingerprints WHERE id = ? AND user_defined = 1').run(id);
    return r.changes > 0;
  }

  getById(id: number): FingerprintRow | null {
    return (
      this.db
        .query<FingerprintRow, [number]>(
          'SELECT id, match_type, pattern, kind, label, confidence, user_defined, created_at FROM source_fingerprints WHERE id = ?',
        )
        .get(id) ?? null
    );
  }
}
