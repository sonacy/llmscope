import type { Database } from 'bun:sqlite';

export class ReplaysRepo {
  constructor(private db: Database) {}

  insert(parentId: string, childId: string): void {
    this.db.prepare('INSERT INTO replays(child_id, parent_id) VALUES (?, ?)').run(childId, parentId);
  }

  childrenOf(parentId: string): string[] {
    return (this.db
      .query<{ child_id: string }, [string]>('SELECT child_id FROM replays WHERE parent_id = ? ORDER BY created_at ASC')
      .all(parentId) as { child_id: string }[]).map((r) => r.child_id);
  }
}
