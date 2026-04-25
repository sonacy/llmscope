import type { ServerWebSocket } from 'bun';
import type { Broadcaster, BroadcastFrame } from './broadcaster';

interface SocketData {
  unsubscribe: () => void;
}

export interface StreamHandlers {
  upgrade(req: Request, server: { upgrade(req: Request, opts?: unknown): boolean }): Response | undefined;
  websocket: {
    open: (ws: ServerWebSocket<SocketData>) => void;
    message: (ws: ServerWebSocket<SocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<SocketData>) => void;
  };
}

const ALLOWED_ORIGIN_HOSTS = ['127.0.0.1', 'localhost'];

export function isAllowedOrigin(origin: string | null, port: number): boolean {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (!ALLOWED_ORIGIN_HOSTS.includes(u.hostname)) return false;
    if (u.port && Number(u.port) !== port) return false;
    return true;
  } catch {
    return false;
  }
}

export function createStreamHandlers(deps: { broadcaster: Broadcaster; token: string; port: number }): StreamHandlers {
  return {
    upgrade(req, server) {
      const url = new URL(req.url);
      if (url.pathname !== '/api/stream') return undefined;
      const queryToken = url.searchParams.get('token');
      if (queryToken !== deps.token) return new Response('unauthorized', { status: 401 });
      if (!isAllowedOrigin(req.headers.get('origin'), deps.port)) return new Response('forbidden', { status: 403 });
      const ok = server.upgrade(req, { data: { unsubscribe: () => {} } satisfies SocketData });
      if (!ok) return new Response('upgrade failed', { status: 426 });
      return undefined;
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: 'hello' }));
        const unsub = deps.broadcaster.subscribe((frame: BroadcastFrame) => {
          ws.send(JSON.stringify(frame));
        });
        ws.data = { unsubscribe: unsub };
      },
      message(ws, message) {
        if (typeof message === 'string' && message === 'ping') ws.send('pong');
      },
      close(ws) {
        ws.data?.unsubscribe?.();
      },
    },
  };
}
