import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { ListResponse, EventSummary, StreamFrame } from '../lib/types';
import { EventTable } from '../components/EventTable';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/Button';
import { useStream } from '../lib/ws';

interface EventListProps {
  query: URLSearchParams;
}

function buildPath(query: URLSearchParams, cursor?: string | null): string {
  const p = new URLSearchParams();
  for (const [k, v] of query.entries()) p.set(k, v);
  if (cursor) p.set('cursor', cursor);
  p.set('limit', '50');
  return `/api/events?${p.toString()}`;
}

export function EventList({ query }: EventListProps) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<ListResponse>(buildPath(query));
      setEvents(r.events);
      setNextCursor(r.next_cursor);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const onFrame = useCallback(
    async (f: StreamFrame) => {
      if ('kind' in f && f.kind === 'event_new') {
        try {
          const fresh = await api<ListResponse>(buildPath(query));
          setEvents(fresh.events);
        } catch {
          /* */
        }
      }
    },
    [query],
  );
  useStream(onFrame);

  async function loadMore() {
    if (!nextCursor) return;
    const r = await api<ListResponse>(buildPath(query, nextCursor));
    setEvents((prev) => [...prev, ...r.events]);
    setNextCursor(r.next_cursor);
  }

  return (
    <div className="space-y-4">
      <FilterBar query={query} />
      {error ? (
        <div className="rounded-md border border-red-800 bg-red-950/40 text-red-200 text-xs p-3">{error}</div>
      ) : loading && events.length === 0 ? (
        <div className="text-xs text-zinc-500">Loading…</div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No events yet"
          hint="Install the addon and route some traffic through your proxy: llmscope install whistle, then llmscope start."
        />
      ) : (
        <>
          <EventTable events={events} />
          {nextCursor ? (
            <div className="text-center">
              <Button variant="ghost" onClick={loadMore}>
                load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
