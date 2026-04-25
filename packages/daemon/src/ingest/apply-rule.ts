import type { Database } from 'bun:sqlite';
import { attribute, hostFromUrl, uaFromHeaders, type Fingerprint } from '@llmscope/core';
import type { EventsRepo, EventRow } from '../db/events-repo';
import type { Broadcaster } from '../broadcaster';

export function applyRuleToRecentEvents(
  db: Database,
  events: EventsRepo,
  rule: Fingerprint,
  sinceTsMs: number,
  broadcaster: Broadcaster,
): { matched: number } {
  const rows = db
    .query<EventRow, [number]>(`SELECT * FROM events WHERE created_at * 1000 >= ?`)
    .all(sinceTsMs) as EventRow[];
  let matched = 0;
  for (const r of rows) {
    const ua = uaFromHeaders(safeJson(r.request_headers));
    const host = r.host || hostFromUrl(r.url);
    const single = attribute({ ua, host, body: r.request_body }, [{ ...rule, user_defined: true }]);
    if (single.kind !== 'unknown') {
      events.updateSource(r.id, single.kind, single.label, single.confidence);
      broadcaster.publish({ kind: 'event_update', id: r.id });
      matched++;
    }
  }
  return { matched };
}

function safeJson(s: string): Record<string, string> {
  try {
    const o = JSON.parse(s);
    if (o && typeof o === 'object') return o as Record<string, string>;
  } catch {
    /* */
  }
  return {};
}
