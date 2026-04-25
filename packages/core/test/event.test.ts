import { describe, it, expect } from 'bun:test';
import { IngestEventSchema } from '../src/event.ts';

const baseEvent = {
  ts_start: 1714032000000,
  ts_end: 1714032001500,
  transport: 'sse' as const,
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  request_headers: { 'content-type': 'application/json', 'user-agent': 'OpenAI/Codex-CLI 0.5' },
  request_body: '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}],"stream":true}',
  status: 200,
  response_headers: { 'content-type': 'text/event-stream' },
  response_body: '{"choices":[{"message":{"role":"assistant","content":"hello"}}]}',
};

describe('IngestEventSchema', () => {
  it('parses a minimal valid event', () => {
    const r = IngestEventSchema.safeParse(baseEvent);
    expect(r.success).toBe(true);
  });

  it('parses with optional hint and reassembled metadata', () => {
    const r = IngestEventSchema.safeParse({
      ...baseEvent,
      hint: { provider: 'openai', model: 'gpt-4o', source_kind: 'codex', source_label: 'Codex CLI' },
      reassembled: { chunks: 12, first_byte_ms: 220, usage: { prompt_tokens: 7, completion_tokens: 4, total_tokens: 11 } },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level fields (strict)', () => {
    const r = IngestEventSchema.safeParse({ ...baseEvent, surprise: 'no' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid transport', () => {
    const r = IngestEventSchema.safeParse({ ...baseEvent, transport: 'tcp' });
    expect(r.success).toBe(false);
  });

  it('rejects non-URL url', () => {
    const r = IngestEventSchema.safeParse({ ...baseEvent, url: 'not a url' });
    expect(r.success).toBe(false);
  });

  it('allows null bodies', () => {
    const r = IngestEventSchema.safeParse({ ...baseEvent, request_body: null, response_body: null, status: null });
    expect(r.success).toBe(true);
  });
});
