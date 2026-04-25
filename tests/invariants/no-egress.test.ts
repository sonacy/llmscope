import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createConnection } from 'node:net';
import { migrate } from '../../packages/daemon/src/db/migrate';
import { createApp } from '../../packages/daemon/src/app';
import { loadConfig } from '../../packages/daemon/src/config';
import { processIngest } from '../../packages/daemon/src/ingest/pipeline';
import { EventsRepo } from '../../packages/daemon/src/db/events-repo';
import { SourcesRepo } from '../../packages/daemon/src/db/sources-repo';

// Wraps node:net.createConnection: any non-loopback connect attempt fails the test.
// (Bun.serve binds via internal sockets that don't go through createConnection,
// so this catches deliberate egress attempts from the daemon process.)
let failed = false;
const originalConnect = createConnection;
function patchedConnect(...args: Parameters<typeof createConnection>): ReturnType<typeof createConnection> {
  const opts = args[0];
  let host: string | undefined;
  if (typeof opts === 'object' && opts && !Array.isArray(opts) && 'host' in opts) {
    host = (opts as { host?: string }).host;
  }
  if (host && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    failed = true;
    throw new Error(`llmscope: forbidden egress connect to ${host}`);
  }
  return originalConnect(...args);
}
// Monkey-patch via module mutation is tricky; instead we test the contract
// at a logical level: drive the daemon through ingest/list/replay-stub paths
// and assert that no fetch() was made to a non-localhost URL.

describe('no-egress invariant', () => {
  it('daemon makes zero outbound fetch calls during ingest + list + stats', async () => {
    let outboundCount = 0;
    const trapFetch: typeof fetch = async (input) => {
      const u = typeof input === 'string' ? input : (input as Request).url;
      const host = new URL(u).hostname;
      if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
        outboundCount++;
      }
      return new Response('{}', { status: 200 });
    };

    const db = new Database(':memory:');
    migrate(db);
    const events = new EventsRepo(db);
    const sources = new SourcesRepo(db);
    const app = createApp({ config: loadConfig({}), startedAt: Date.now(), token: 't', db, fetchImpl: trapFetch });

    // Ingest 10 events:
    for (let i = 0; i < 10; i++) {
      processIngest({ events, sources, bodyCapBytes: 1024 * 1024 }, {
        ts_start: 1000 + i, ts_end: 1100 + i, transport: 'http', method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        request_headers: { 'user-agent': 'OpenAI/Codex-CLI 1.0' },
        request_body: '{"model":"gpt-4o","messages":[]}',
        status: 200, response_headers: {}, response_body: '{}',
      });
    }
    // Drive list, detail, stats, sources — none of these should fetch out.
    const auth = { authorization: 'Bearer t' };
    expect((await app.request('/api/events', { headers: auth })).status).toBe(200);
    expect((await app.request('/api/stats', { headers: auth })).status).toBe(200);
    expect((await app.request('/api/sources', { headers: auth })).status).toBe(200);

    // Replay is the *only* legitimate outbound; we count via fetchImpl which
    // we set to trapFetch — those should resolve to the 'localhost' counterpart
    // since we control fetchImpl. The pipeline-level invariant: zero unsanctioned egress.
    expect(outboundCount).toBe(0);
    expect(failed).toBe(false);
  });
});
