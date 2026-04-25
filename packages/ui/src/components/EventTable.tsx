import type { EventSummary } from '../lib/types';
import { navigate } from '../lib/router';

interface EventTableProps {
  events: EventSummary[];
}

function fmtTs(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

function fmtTokens(e: EventSummary): string {
  if (e.total_tokens != null) return e.total_tokens.toLocaleString();
  if (e.prompt_tokens != null || e.completion_tokens != null) {
    return `${e.prompt_tokens ?? 0}/${e.completion_tokens ?? 0}`;
  }
  return '—';
}

export function EventTable({ events }: EventTableProps) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="min-w-full text-xs">
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            <th className="text-left px-3 py-2 font-medium">time</th>
            <th className="text-left px-3 py-2 font-medium">source</th>
            <th className="text-left px-3 py-2 font-medium">provider</th>
            <th className="text-left px-3 py-2 font-medium">model</th>
            <th className="text-right px-3 py-2 font-medium">tokens</th>
            <th className="text-right px-3 py-2 font-medium">latency</th>
            <th className="text-left px-3 py-2 font-medium">status</th>
            <th className="text-left px-3 py-2 font-medium">preview</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={e.id}
              onClick={() => navigate(`/events/${e.id}`)}
              className="border-t border-zinc-900 hover:bg-zinc-900/60 cursor-pointer"
            >
              <td className="px-3 py-2 tabular-nums">{fmtTs(e.ts_start)}</td>
              <td className="px-3 py-2">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{e.source.label}</span>
              </td>
              <td className="px-3 py-2">{e.provider}</td>
              <td className="px-3 py-2 font-mono">{e.model ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtTokens(e)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{e.latency_ms} ms</td>
              <td className="px-3 py-2">
                {e.status == null
                  ? <span className="text-red-400">err</span>
                  : e.status >= 400
                  ? <span className="text-red-400">{e.status}</span>
                  : <span className="text-emerald-400">{e.status}</span>}
              </td>
              <td className="px-3 py-2 text-zinc-400 max-w-[24rem] truncate" title={e.preview}>
                {e.preview}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
