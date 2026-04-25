import { useEffect, useRef, useState } from 'react';
import { readSavedToken } from './api';
import type { StreamFrame } from './types';

export interface WsState {
  connected: boolean;
  lastFrame: StreamFrame | null;
}

export function useStream(onFrame?: (f: StreamFrame) => void): WsState {
  const [connected, setConnected] = useState(false);
  const [lastFrame, setLastFrame] = useState<StreamFrame | null>(null);
  const handlerRef = useRef(onFrame);
  handlerRef.current = onFrame;

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (!alive) return;
      const token = readSavedToken();
      if (!token) {
        reconnectTimer = window.setTimeout(connect, 1000);
        return;
      }
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/api/stream?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (alive) reconnectTimer = window.setTimeout(connect, 1000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (e) => {
        try {
          const f = JSON.parse(String(e.data)) as StreamFrame;
          setLastFrame(f);
          handlerRef.current?.(f);
        } catch {
          /* */
        }
      };
    };
    connect();
    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { connected, lastFrame };
}
