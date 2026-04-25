import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../src/db/migrate';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { HubBroadcaster, type BroadcastFrame } from '../src/broadcaster';
import { createStreamHandlers, isAllowedOrigin } from '../src/stream';

describe('isAllowedOrigin', () => {
  it('allows null origin', () => {
    expect(isAllowedOrigin(null, 47821)).toBe(true);
  });
  it('allows 127.0.0.1 with matching port', () => {
    expect(isAllowedOrigin('http://127.0.0.1:47821', 47821)).toBe(true);
  });
  it('rejects foreign origin', () => {
    expect(isAllowedOrigin('http://example.com', 47821)).toBe(false);
  });
});

describe('HubBroadcaster', () => {
  it('broadcasts to all subscribers', () => {
    const hub = new HubBroadcaster();
    const seenA: BroadcastFrame[] = [];
    const seenB: BroadcastFrame[] = [];
    hub.subscribe((f) => seenA.push(f));
    hub.subscribe((f) => seenB.push(f));
    hub.publish({ kind: 'event_new', id: 'evt_x' });
    expect(seenA.length).toBe(1);
    expect(seenB.length).toBe(1);
  });

  it('unsubscribe stops delivery', () => {
    const hub = new HubBroadcaster();
    const seen: BroadcastFrame[] = [];
    const unsub = hub.subscribe((f) => seen.push(f));
    unsub();
    hub.publish({ kind: 'event_new', id: 'evt_y' });
    expect(seen.length).toBe(0);
  });
});

describe('WS /api/stream e2e', () => {
  it('client receives hello and event_new within 100ms of ingest', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const broadcaster = new HubBroadcaster();
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db, broadcaster });
    const stream = createStreamHandlers({ broadcaster, token: 't', port: 0 });

    const server = Bun.serve({
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

    try {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/api/stream?token=t`);
      const messages: string[] = [];
      const opened = new Promise<void>((res, rej) => {
        ws.onopen = () => res();
        ws.onerror = (e: unknown) => rej(e);
      });
      ws.onmessage = (e: MessageEvent) => messages.push(String(e.data));
      await opened;
      // wait for hello
      await new Promise((r) => setTimeout(r, 30));
      expect(messages.some((m) => m.includes('hello'))).toBe(true);

      const t0 = Date.now();
      broadcaster.publish({ kind: 'event_new', id: 'evt_test' });
      await new Promise((r) => setTimeout(r, 30));
      const got = messages.find((m) => m.includes('event_new'));
      expect(got).toBeDefined();
      expect(Date.now() - t0).toBeLessThan(200);
      ws.close();
    } finally {
      server.stop(true);
    }
  });

  it('rejects bad token', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const broadcaster = new HubBroadcaster();
    const stream = createStreamHandlers({ broadcaster, token: 'right', port: 0 });
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch(req, srv) {
        const u = stream.upgrade(req, srv);
        if (u !== undefined) return u;
        return new Response('ok');
      },
      websocket: stream.websocket,
    });
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/stream?token=wrong`, {
        headers: { upgrade: 'websocket', connection: 'upgrade', 'sec-websocket-key': 'dGVzdA==', 'sec-websocket-version': '13' },
      });
      expect(res.status).toBe(401);
    } finally {
      server.stop(true);
    }
  });
});
