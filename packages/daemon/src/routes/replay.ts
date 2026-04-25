import { Hono } from 'hono';
import { MASK_TOKEN } from '@llmscope/core';
import type { EventsRepo, EventRow } from '../db/events-repo';
import type { SourcesRepo } from '../db/sources-repo';
import type { ReplaysRepo } from '../db/replays-repo';
import type { Broadcaster } from '../broadcaster';
import { processIngest } from '../ingest/pipeline';

export interface ReplayDeps {
  events: EventsRepo;
  sources: SourcesRepo;
  replays: ReplaysRepo;
  broadcaster: Broadcaster;
  bodyCapBytes: number;
  fetchImpl?: typeof fetch;
}

const STRIPPED_HEADERS = new Set(['content-length', 'host', 'transfer-encoding', 'connection']);

export function replayRoute(deps: ReplayDeps): Hono {
  const r = new Hono();
  r.post('/:id/replay', async (c) => {
    const parent = deps.events.getById(c.req.param('id'));
    if (!parent) return c.json({ error: 'not found' }, 404);
    if (parent.transport === 'ws') return c.json({ error: 'replay_not_supported_for_ws' }, 501);

    const headers = JSON.parse(parent.request_headers) as Record<string, string>;
    const authValue = headers['authorization'] ?? headers['Authorization'];
    if (authValue && authValue.includes(MASK_TOKEN)) {
      return c.json({ error: 'replay_requires_auth' }, 409);
    }

    const outboundHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (STRIPPED_HEADERS.has(k.toLowerCase())) continue;
      if (typeof v !== 'string' || v.includes(MASK_TOKEN)) continue;
      outboundHeaders[k] = v;
    }

    const fetchImpl = deps.fetchImpl ?? fetch;
    const tsStart = Date.now();
    let res: Response;
    try {
      res = await fetchImpl(parent.url, {
        method: parent.method,
        headers: outboundHeaders,
        body: parent.method === 'GET' || parent.method === 'HEAD' ? undefined : parent.request_body ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'replay failed';
      return c.json({ error: 'replay_network_error', detail: msg }, 502);
    }
    const responseBody = await res.text();
    const tsEnd = Date.now();

    const child = processIngest(
      { events: deps.events, sources: deps.sources, bodyCapBytes: deps.bodyCapBytes },
      buildChildRaw(parent, outboundHeaders, res, responseBody, tsStart, tsEnd),
    );
    deps.events.setParent(child.id, parent.id);
    deps.replays.insert(parent.id, child.id);
    deps.broadcaster.publish({ kind: 'event_new', id: child.id });
    return c.json({ new_event_id: child.id, parent_id: parent.id }, 201);
  });
  return r;
}

function buildChildRaw(
  parent: EventRow,
  outboundHeaders: Record<string, string>,
  res: Response,
  responseBody: string,
  tsStart: number,
  tsEnd: number,
): unknown {
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    responseHeaders[k] = v;
  });
  return {
    ts_start: tsStart,
    ts_end: tsEnd,
    transport: 'http',
    method: parent.method,
    url: parent.url,
    request_headers: outboundHeaders,
    request_body: parent.request_body,
    status: res.status,
    response_headers: responseHeaders,
    response_body: responseBody,
    hint: { provider: parent.provider, source_kind: parent.source_kind, source_label: parent.source_label, model: parent.model ?? undefined },
  };
}

