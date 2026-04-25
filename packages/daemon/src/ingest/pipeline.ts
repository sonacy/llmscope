import {
  attribute,
  capBody,
  costUsd,
  detectProvider,
  hostFromUrl,
  IngestEventSchema,
  maskHeaders,
  newEventId,
  uaFromHeaders,
  type IngestEvent,
} from '@llmscope/core';
import type { EventsRepo, EventRow } from '../db/events-repo';
import type { SourcesRepo } from '../db/sources-repo';
import { extractModel, extractUsageFromResponse } from './extract';

export interface IngestResult {
  id: string;
  source_kind: string;
  provider: string;
}

export interface IngestPipelineDeps {
  events: EventsRepo;
  sources: SourcesRepo;
  bodyCapBytes: number;
}

export function processIngest(deps: IngestPipelineDeps, raw: unknown): IngestResult {
  const parsed: IngestEvent = IngestEventSchema.parse(raw);
  const id = newEventId(parsed.ts_start);
  const host = hostFromUrl(parsed.url);
  const provider = parsed.hint?.provider ?? detectProvider(parsed.url);
  const model = parsed.hint?.model ?? extractModel(parsed.request_body);

  const fingerprints = deps.sources.loadAll();
  const ua = uaFromHeaders(parsed.request_headers);
  const source = parsed.hint?.source_kind
    ? {
        kind: parsed.hint.source_kind,
        label: parsed.hint.source_label ?? parsed.hint.source_kind,
        confidence: 1.0,
      }
    : attribute({ ua, host, body: parsed.request_body }, fingerprints);

  // Defense-in-depth: re-mask headers, then cap bodies.
  const reqHeaders = maskHeaders(parsed.request_headers);
  const resHeaders = maskHeaders(parsed.response_headers);
  const reqCap = capBody(parsed.request_body, deps.bodyCapBytes);
  const resCap = capBody(parsed.response_body, deps.bodyCapBytes);

  const usage = parsed.reassembled?.usage ?? extractUsageFromResponse(parsed.response_body);
  const promptTokens = usage.prompt_tokens ?? null;
  const completionTokens = usage.completion_tokens ?? null;
  const totalTokens =
    usage.total_tokens ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
  const cost = model && promptTokens != null && completionTokens != null
    ? costUsd(model, promptTokens, completionTokens)
    : null;

  const row: Omit<EventRow, 'created_at'> = {
    id,
    ts_start: parsed.ts_start,
    ts_end: parsed.ts_end,
    transport: parsed.transport,
    method: parsed.method,
    url: parsed.url,
    host,
    status: parsed.status,
    source_kind: source.kind,
    source_label: source.label,
    source_confidence: source.confidence,
    provider,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_usd: cost,
    latency_ms: Math.max(0, parsed.ts_end - parsed.ts_start),
    request_headers: JSON.stringify(reqHeaders),
    response_headers: JSON.stringify(resHeaders),
    request_body: reqCap.body,
    response_body: resCap.body,
    request_body_truncated: (parsed.request_body_truncated || reqCap.truncated) ? 1 : 0,
    response_body_truncated: (parsed.response_body_truncated || resCap.truncated) ? 1 : 0,
    reassembled_meta: parsed.reassembled ? JSON.stringify(parsed.reassembled) : null,
    error: parsed.error ?? null,
    parent_id: null,
  };

  deps.events.insert(row);
  return { id, source_kind: source.kind, provider };
}
