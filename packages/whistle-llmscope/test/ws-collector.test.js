'use strict';

const { describe, it, expect } = require('bun:test');
const { EventEmitter } = require('node:events');
const { WsCollector, attachToTunnel, probeTunnelSupport } = require('../src/ws-collector');

describe('probeTunnelSupport', () => {
  it('rejects non-emitter inputs', () => {
    expect(probeTunnelSupport(null)).toBe(false);
    expect(probeTunnelSupport({})).toBe(false);
  });
  it('accepts an EventEmitter-shaped object', () => {
    expect(probeTunnelSupport(new EventEmitter())).toBe(true);
  });
});

describe('attachToTunnel + reassemble openai realtime', () => {
  it('aggregates response.text.delta + usage', () => {
    const tunnel = new EventEmitter();
    const { collector, supported } = attachToTunnel(tunnel);
    expect(supported).toBe(true);
    tunnel.emit('frame', 'client', '{"type":"response.create","response":{}}');
    tunnel.emit('frame', 'server', '{"type":"response.text.delta","delta":"Hi "}');
    tunnel.emit('frame', 'server', '{"type":"response.text.delta","delta":"there"}');
    tunnel.emit('frame', 'server', '{"type":"response.done","response":{"usage":{"input_tokens":5,"output_tokens":2,"total_tokens":7}}}');
    tunnel.emit('close');
    const r = collector.reassemble('openai');
    expect(r.transcript).toBe('Hi there');
    expect(r.usage.total_tokens).toBe(7);
    expect(r.frames).toBe(4);
    expect(r.events.find((e) => e.type === 'response.text.delta').count).toBe(2);
  });
});

describe('WsCollector standalone', () => {
  it('falls back to direction-tagged transcript for unknown providers', () => {
    const c = new WsCollector();
    c.push('client', 'hi');
    expect(c.reassemble('unknown').transcript).toContain('[client] hi');
  });
});
