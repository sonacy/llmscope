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

export interface EventDetail extends EventSummary {
  method: string;
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  request_body: string | null;
  response_body: string | null;
  reassembled_meta: Record<string, unknown> | null;
  parent_id: string | null;
  source_kind: string;
  source_label: string;
  source_confidence: number;
}

export interface ListResponse {
  events: EventSummary[];
  next_cursor: string | null;
}

export interface StatsResponse {
  range: string;
  bucket: string;
  groupBy: string;
  since_ms: number;
  until_ms: number;
  series: { bucket: string; group_value: string; prompt_tokens: number; completion_tokens: number; total_tokens: number; request_count: number }[];
  totals: { request_count: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_usd: number; unpriced_models: string[] };
}

export interface FingerprintRow {
  id: number;
  match_type: 'ua_exact' | 'ua_prefix' | 'ua_regex' | 'host' | 'shape';
  pattern: string;
  kind: string;
  label: string;
  confidence: number;
  user_defined: 0 | 1;
  created_at: number;
}

export interface SourcesResponse {
  builtin: FingerprintRow[];
  user: FingerprintRow[];
}

export type StreamFrame =
  | { type: 'hello' }
  | { kind: 'event_new'; id: string }
  | { kind: 'event_update'; id: string }
  | { kind: 'stats_invalidate' };
