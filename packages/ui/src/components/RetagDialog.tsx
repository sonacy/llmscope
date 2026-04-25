import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import type { EventDetail } from '../lib/types';

interface RetagDialogProps {
  event: EventDetail;
  onClose: () => void;
  onSuccess: () => void;
}

type MatchType = 'ua_exact' | 'ua_prefix' | 'host';

export function RetagDialog({ event, onClose, onSuccess }: RetagDialogProps) {
  const ua = (event.request_headers['user-agent'] ?? event.request_headers['User-Agent'] ?? '').trim();
  const [matchType, setMatchType] = useState<MatchType>(ua ? 'ua_prefix' : 'host');
  const [pattern, setPattern] = useState(matchType === 'host' ? event.host : ua);
  const [kind, setKind] = useState(event.source_kind === 'unknown' ? 'my-app' : event.source_kind);
  const [label, setLabel] = useState(event.source_label === ua ? 'My App' : event.source_label);
  const [confidence, setConfidence] = useState(0.95);
  const [backApply, setBackApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onMatchTypeChange(mt: MatchType) {
    setMatchType(mt);
    if (mt === 'host') setPattern(event.host);
    else setPattern(ua);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: number }>('/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ match_type: matchType, pattern, kind, label, confidence }),
      });
      if (backApply) {
        await api(`/api/sources/${created.id}/apply`, { method: 'POST' });
      }
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={submit} className="w-[28rem] rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <h3 className="text-sm font-medium">Re-tag source</h3>
        <div className="space-y-2 text-xs">
          <label className="block">
            <span className="text-zinc-400">match by</span>
            <select
              value={matchType}
              onChange={(e) => onMatchTypeChange(e.target.value as MatchType)}
              className="block mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
            >
              <option value="ua_exact">User-Agent exact</option>
              <option value="ua_prefix">User-Agent prefix</option>
              <option value="host">host</option>
            </select>
          </label>
          <label className="block">
            <span className="text-zinc-400">pattern</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              required
              className="block mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 font-mono"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-zinc-400">kind</span>
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                required
                className="block mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-zinc-400">label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="block mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={backApply} onChange={(e) => setBackApply(e.target.checked)} />
            <span>back-apply to last 7 days of matching events</span>
          </label>
        </div>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            cancel
          </Button>
          <Button type="submit" disabled={busy}>{busy ? 'saving…' : 'save rule'}</Button>
        </div>
      </form>
    </div>
  );
}
