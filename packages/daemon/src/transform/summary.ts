import type { EventRow } from '../db/events-repo';

export interface EventSummary {
  id: string;
  ts_start: number;
  ts_end: number;
  transport: 'http' | 'sse' | 'ws';
  status: number | null;
  source: { kind: string; label: string; confidence: number };
  provider: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number;
  url: string;
  host: string;
  preview: string;
  error: string | null;
  request_body_truncated: boolean;
  response_body_truncated: boolean;
}

const PREVIEW_MAX = 200;

export function lastUserContent(requestBody: string | null): string {
  if (!requestBody) return '';
  try {
    const o = JSON.parse(requestBody);
    if (Array.isArray(o?.messages)) {
      for (let i = o.messages.length - 1; i >= 0; i--) {
        const m = o.messages[i];
        if (m?.role === 'user') {
          if (typeof m.content === 'string') return m.content;
          if (Array.isArray(m.content)) {
            const text = m.content.find((p: unknown): p is { type: string; text: string } => {
              return !!p && typeof p === 'object' && (p as { type?: unknown }).type === 'text';
            });
            if (text) return text.text;
          }
        }
      }
    }
    if (typeof o?.prompt === 'string') return o.prompt;
    if (Array.isArray(o?.contents)) {
      for (let i = o.contents.length - 1; i >= 0; i--) {
        const c = o.contents[i];
        if (Array.isArray(c?.parts)) {
          const text = c.parts.find((p: unknown): p is { text: string } => {
            return !!p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string';
          });
          if (text) return text.text;
        }
      }
    }
  } catch {
    /* */
  }
  return '';
}

export function toSummary(row: EventRow): EventSummary {
  const preview = lastUserContent(row.request_body).slice(0, PREVIEW_MAX);
  return {
    id: row.id,
    ts_start: row.ts_start,
    ts_end: row.ts_end,
    transport: row.transport,
    status: row.status,
    source: { kind: row.source_kind, label: row.source_label, confidence: row.source_confidence },
    provider: row.provider,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    total_tokens: row.total_tokens,
    cost_usd: row.cost_usd,
    latency_ms: row.latency_ms,
    url: row.url,
    host: row.host,
    preview,
    error: row.error,
    request_body_truncated: row.request_body_truncated === 1,
    response_body_truncated: row.response_body_truncated === 1,
  };
}
