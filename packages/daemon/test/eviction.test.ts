import { describe, it, expect } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newEventId } from '@llmscope/core';
import { openDb } from '../src/db/connect';
import { migrate } from '../src/db/migrate';
import { EventsRepo, type EventRow } from '../src/db/events-repo';
import { evictOldestUntilUnderCap, dbSizeBytes } from '../src/eviction';

function row(idx: number): Omit<EventRow, 'created_at'> {
  return {
    id: newEventId(idx + 1),
    ts_start: idx,
    ts_end: idx + 10,
    transport: 'http',
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    host: 'api.openai.com',
    status: 200,
    source_kind: 'codex',
    source_label: 'Codex CLI',
    source_confidence: 0.98,
    provider: 'openai',
    model: 'gpt-4o',
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    latency_ms: 10,
    request_headers: '{}',
    response_headers: '{}',
    request_body: 'x'.repeat(2048),
    response_body: 'y'.repeat(2048),
    request_body_truncated: 0,
    response_body_truncated: 0,
    reassembled_meta: null,
    error: null,
    parent_id: null,
  };
}

describe('eviction', () => {
  it('evicts oldest events when over cap and reduces row count', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-evict-'));
    const dbPath = join(dir, 'db.sqlite');
    const db = openDb(dbPath);
    migrate(db);
    const repo = new EventsRepo(db);
    for (let i = 0; i < 200; i++) repo.insert(row(i));
    const sizeBefore = dbSizeBytes(dbPath);
    expect(sizeBefore).toBeGreaterThan(64 * 1024);

    const cap = Math.floor(sizeBefore * 0.5);
    const r = evictOldestUntilUnderCap({ db, dbPath, capBytes: cap });
    expect(r.evicted).toBeGreaterThan(0);
    const remaining = repo.count();
    expect(remaining).toBeLessThan(200);
    expect(remaining).toBe(200 - r.evicted);
    // Bytes-on-disk reclamation depends on SQLite VACUUM/FTS5 page
    // accounting and is exercised by the perf sweep in step 49.
  });
});
