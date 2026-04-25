'use strict';

// WebSocket frame collector. Whistle's plugin API for WS frames varies by
// version; users should consult the README for the supported probe outcome.
// This module operates on a duck-typed `tunnel` event-emitter:
//   tunnel.on('frame', (direction, text, ts?) => ...)
//   tunnel.on('close', () => ...)
// Real whistle bindings vary; collector accepts any emitter conforming to that.

const { reassembleSse } = require('./sse-collector');

function probeTunnelSupport(tunnel) {
  if (!tunnel || typeof tunnel.on !== 'function') return false;
  // Whistle's tunnel object typically has `.on` for events; a richer probe
  // would attach a temporary listener and time out.
  return true;
}

class WsCollector {
  constructor() {
    this.frames = [];
    this.closed = false;
  }
  push(direction, text, ts) {
    if (this.closed) return;
    this.frames.push({ direction, ts: ts != null ? ts : Date.now(), text });
  }
  close() {
    this.closed = true;
  }
  reassemble(provider) {
    // Lightweight provider-agnostic timeline; OpenAI Realtime structured
    // reassembly happens in core/ws.ts on the daemon side.
    let transcript = '';
    let usage;
    const events = new Map();
    if (provider === 'openai') {
      for (const f of this.frames) {
        let json;
        try { json = JSON.parse(f.text); } catch { continue; }
        const t = (json && json.type) || 'unknown';
        events.set(t, (events.get(t) || 0) + 1);
        if (t === 'response.text.delta' && typeof json.delta === 'string') transcript += json.delta;
        else if (t === 'response.audio_transcript.delta' && typeof json.delta === 'string') transcript += json.delta;
        else if (t === 'response.done' && json.response && json.response.usage) {
          usage = {
            prompt_tokens: json.response.usage.input_tokens,
            completion_tokens: json.response.usage.output_tokens,
            total_tokens: json.response.usage.total_tokens,
          };
        }
      }
      return {
        transcript,
        usage,
        frames: this.frames.length,
        events: Array.from(events, ([type, count]) => ({ type, count })),
      };
    }
    return {
      transcript: this.frames.map((f) => `[${f.direction}] ${f.text}`).join('\n'),
      frames: this.frames.length,
      events: [],
    };
  }
}

function attachToTunnel(tunnel) {
  const c = new WsCollector();
  if (!probeTunnelSupport(tunnel)) return { collector: c, supported: false };
  tunnel.on('frame', (direction, text, ts) => c.push(direction, text, ts));
  tunnel.on('close', () => c.close());
  return { collector: c, supported: true };
}

module.exports = { WsCollector, probeTunnelSupport, attachToTunnel, reassembleSse };
