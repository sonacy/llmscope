import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../packages/daemon/src/app';
import { loadConfig } from '../../packages/daemon/src/config';
import { migrate } from '../../packages/daemon/src/db/migrate';
import { HubBroadcaster, type BroadcastFrame } from '../../packages/daemon/src/broadcaster';
import { createStreamHandlers } from '../../packages/daemon/src/stream';

const TOKEN = 'e2e-token-' + 'a'.repeat(40);
const FIXTURE_DIR = join(__dirname, 'fixtures');

let server: ReturnType<typeof Bun.serve>;
let port: number;
let broadcaster: HubBroadcaster;

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));
}

beforeAll(() => {
  const db = new Database(':memory:');
  migrate(db);
  broadcaster = new HubBroadcaster();
  const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: TOKEN, db, broadcaster });
  const stream = createStreamHandlers({ broadcaster, token: TOKEN, port: 0 });
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req, srv) {
      const u = stream.upgrade(req, srv);
      if (u !== undefined) return u;
      if (new URL(req.url).pathname === '/api/stream') return new Response(null);
      return app.fetch(req);
    },
    websocket: stream.websocket,
  });
  port = server.port;
});

afterAll(() => {
  server?.stop?.(true);
});

async function ingest(payload: unknown): Promise<{ id: string }> {
  const r = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  if (r.status !== 201) throw new Error(`ingest ${r.status}: ${await r.text()}`);
  return (await r.json()) as { id: string };
}

describe('e2e smoke', () => {
  it('ingests three samples → list shows them', async () => {
    const a = await ingest(readFixture('sample-a.json'));
    const b = await ingest(readFixture('sample-b.json'));
    const c = await ingest(readFixture('sample-c.json'));
    expect(a.id).toMatch(/^evt_/);
    expect(b.id).toMatch(/^evt_/);
    expect(c.id).toMatch(/^evt_/);
    const listRes = await fetch(`http://127.0.0.1:${port}/api/events?limit=50`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    const list = (await listRes.json()) as { events: { id: string; provider: string; source: { kind: string } }[] };
    expect(list.events.length).toBe(3);
    const providers = new Set(list.events.map((e) => e.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
  });

  it('detail returns full body for sample A', async () => {
    const i = await ingest(readFixture('sample-a.json'));
    const r = await fetch(`http://127.0.0.1:${port}/api/events/${i.id}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { response_body: string; reassembled_meta: unknown };
    expect(j.response_body).toContain('choices');
    expect(j.response_body).toContain('finish_reason');
  });

  it('WS stream delivers event_new frames in real time', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/stream?token=${TOKEN}`);
    const messages: string[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e: unknown) => reject(e);
    });
    ws.onmessage = (e: MessageEvent) => messages.push(String(e.data));
    await new Promise((r) => setTimeout(r, 30));
    await ingest(readFixture('sample-a.json'));
    await new Promise((r) => setTimeout(r, 80));
    expect(messages.some((m) => m.includes('event_new'))).toBe(true);
    ws.close();
  });
});
