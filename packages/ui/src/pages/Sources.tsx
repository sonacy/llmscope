import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { SourcesResponse, FingerprintRow } from '../lib/types';

export function SourcesPage() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    api<SourcesResponse>('/api/sources').then(setData).catch((e) => setError(String(e)));
  }
  useEffect(load, []);

  async function del(id: number) {
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${sessionStorage.getItem('llmscope.token')}` } });
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) return <p className="text-xs text-red-300">{error}</p>;
  if (!data) return <p className="text-xs text-zinc-500">Loading…</p>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardTitle>User rules</CardTitle>
        <RuleList rows={data.user} onDelete={del} />
      </Card>
      <Card>
        <CardTitle>Built-in rules</CardTitle>
        <RuleList rows={data.builtin} />
      </Card>
    </div>
  );
}

function RuleList({ rows, onDelete }: { rows: FingerprintRow[]; onDelete?: (id: number) => void }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-500">No rules.</p>;
  return (
    <ul className="text-xs space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-1 border-b border-zinc-900 last:border-b-0">
          <div className="flex-1 min-w-0">
            <span className="text-zinc-300">{r.label}</span>
            <span className="ml-2 text-zinc-500">{r.match_type}: {r.pattern}</span>
          </div>
          {onDelete ? <Button variant="danger" onClick={() => onDelete(r.id)}>delete</Button> : null}
        </li>
      ))}
    </ul>
  );
}
