import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { StatsResponse } from '../lib/types';
import { Card, CardTitle } from '../components/ui/Card';
import { Bars } from '../components/charts/Bars';

const RANGES = ['24h', '7d', '30d'];

export function StatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [range, setRange] = useState('7d');
  const [groupBy, setGroupBy] = useState('provider');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<StatsResponse>(`/api/stats?range=${range}&bucket=day&groupBy=${groupBy}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [range, groupBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">range</span>
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 py-1 rounded ${range === r ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
          >
            {r}
          </button>
        ))}
        <span className="ml-4 text-zinc-500">group by</span>
        {(['provider', 'source_kind', 'model'] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`px-2 py-1 rounded ${groupBy === g ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
          >
            {g}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : !data ? <p className="text-xs text-zinc-500">Loading…</p> : (
        <>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <Card>
              <CardTitle>Requests</CardTitle>
              <p className="text-2xl tabular-nums">{data.totals.request_count.toLocaleString()}</p>
            </Card>
            <Card>
              <CardTitle>Total tokens</CardTitle>
              <p className="text-2xl tabular-nums">{data.totals.total_tokens.toLocaleString()}</p>
            </Card>
            <Card>
              <CardTitle>Spend</CardTitle>
              <p className="text-2xl tabular-nums">${data.totals.cost_usd.toFixed(4)}</p>
            </Card>
            <Card>
              <CardTitle>Unpriced models</CardTitle>
              <p className="text-xs text-zinc-400 break-all">
                {data.totals.unpriced_models.length === 0 ? 'all priced' : data.totals.unpriced_models.join(', ')}
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle>Tokens by {groupBy}</CardTitle>
            <Bars
              data={Object.entries(
                data.series.reduce<Record<string, number>>((acc, s) => {
                  acc[s.group_value] = (acc[s.group_value] ?? 0) + s.total_tokens;
                  return acc;
                }, {}),
              )
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value)}
            />
          </Card>

          <Card>
            <CardTitle>Requests by {groupBy}</CardTitle>
            <Bars
              data={Object.entries(
                data.series.reduce<Record<string, number>>((acc, s) => {
                  acc[s.group_value] = (acc[s.group_value] ?? 0) + s.request_count;
                  return acc;
                }, {}),
              )
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value)}
            />
          </Card>
        </>
      )}
    </div>
  );
}
