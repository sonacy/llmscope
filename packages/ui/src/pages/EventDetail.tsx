import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { EventDetail as EventDetailType } from '../lib/types';
import { JsonView } from '../components/JsonView';
import { ReplayButton } from '../components/ReplayButton';
import { RetagDialog } from '../components/RetagDialog';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { navigate } from '../lib/router';

interface EventDetailProps {
  id: string;
}

type Tab = 'overview' | 'request' | 'response' | 'headers' | 'timeline' | 'raw';

export function EventDetailPage({ id }: EventDetailProps) {
  const [data, setData] = useState<EventDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [retagOpen, setRetagOpen] = useState(false);

  useEffect(() => {
    setError(null);
    api<EventDetailType>(`/api/events/${id}`).then(setData).catch((e) => setError(String(e)));
  }, [id]);

  if (error)
    return (
      <Card className="border-red-700 bg-red-950/30">
        <CardTitle>Failed to load event</CardTitle>
        <pre className="text-xs">{error}</pre>
      </Card>
    );
  if (!data) return <p className="text-xs text-zinc-500">Loading…</p>;

  const tabs: Tab[] = ['overview', 'request', 'response', 'headers', 'timeline', 'raw'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/')}>← back</Button>
          <h2 className="text-base font-semibold mt-2 break-all">{data.method} {data.url}</h2>
          <div className="text-xs text-zinc-500 mt-1">
            {new Date(data.ts_start).toLocaleString()} · {data.provider} · {data.model ?? '—'} · {data.latency_ms} ms
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setRetagOpen(true)}>re-tag source</Button>
          <ReplayButton eventId={data.id} />
        </div>
      </div>

      {data.request_body_truncated || data.response_body_truncated ? (
        <div className="rounded-md border border-amber-700 bg-amber-950/30 text-amber-200 text-xs px-3 py-2">
          One or more bodies were truncated by the 5 MB cap.
        </div>
      ) : null}

      <div className="border-b border-zinc-800 flex gap-1 text-xs">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === t ? 'border-emerald-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Card>
            <CardTitle>Source</CardTitle>
            <p>{data.source_label} <span className="text-zinc-500">({data.source_kind}, {Math.round(data.source_confidence * 100)}%)</span></p>
          </Card>
          <Card>
            <CardTitle>Tokens</CardTitle>
            <p>prompt: {data.prompt_tokens ?? '—'} · completion: {data.completion_tokens ?? '—'} · total: {data.total_tokens ?? '—'}</p>
          </Card>
          <Card>
            <CardTitle>Cost</CardTitle>
            <p>{data.cost_usd != null ? `$${data.cost_usd.toFixed(6)}` : 'unpriced'}</p>
          </Card>
          <Card>
            <CardTitle>Status</CardTitle>
            <p>{data.status ?? 'no response'}{data.error ? ` · ${data.error}` : ''}</p>
          </Card>
        </div>
      )}
      {tab === 'request' && <JsonView value={data.request_body} />}
      {tab === 'response' && <JsonView value={data.response_body} />}
      {tab === 'headers' && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardTitle>Request headers</CardTitle>
            <JsonView value={data.request_headers} />
          </Card>
          <Card>
            <CardTitle>Response headers</CardTitle>
            <JsonView value={data.response_headers} />
          </Card>
        </div>
      )}
      {tab === 'timeline' && (
        <div className="text-xs text-zinc-400">
          {data.transport === 'sse' ? (
            <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 max-h-[60vh] overflow-auto whitespace-pre-wrap font-mono">
              {data.response_body ?? ''}
            </pre>
          ) : data.transport === 'ws' ? (
            <JsonView value={data.request_body} />
          ) : (
            <p>This is a plain HTTP request — no streaming timeline.</p>
          )}
        </div>
      )}
      {tab === 'raw' && <JsonView value={data} />}

      {retagOpen ? (
        <RetagDialog
          event={data}
          onClose={() => setRetagOpen(false)}
          onSuccess={() => {
            setRetagOpen(false);
            api<EventDetailType>(`/api/events/${id}`).then(setData).catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}
