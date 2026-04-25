import { describe, it, expect } from 'bun:test';
import { reassembleWs, type WsFrame } from '../src/ws.ts';

describe('reassembleWs openai realtime', () => {
  it('aggregates transcript deltas and usage', () => {
    const frames: WsFrame[] = [
      { direction: 'client', ts: 1, text: '{"type":"response.create","response":{}}' },
      { direction: 'server', ts: 2, text: '{"type":"response.text.delta","delta":"Hel"}' },
      { direction: 'server', ts: 3, text: '{"type":"response.text.delta","delta":"lo"}' },
      { direction: 'server', ts: 4, text: '{"type":"response.done","response":{"usage":{"input_tokens":5,"output_tokens":2,"total_tokens":7}}}' },
    ];
    const r = reassembleWs(frames, 'openai');
    expect(r.transcript).toBe('Hello');
    expect(r.usage?.total_tokens).toBe(7);
    expect(r.frames).toBe(4);
    expect(r.events.find((e) => e.type === 'response.text.delta')?.count).toBe(2);
  });

  it('falls back to direction-tagged transcript for unknown providers', () => {
    const frames: WsFrame[] = [{ direction: 'client', ts: 1, text: 'hi' }];
    const r = reassembleWs(frames, 'unknown');
    expect(r.transcript).toContain('[client] hi');
  });
});
