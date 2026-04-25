import { describe, it, expect } from 'bun:test';
import { reassembleSse } from '../src/sse.ts';

describe('reassembleSse openai', () => {
  it('reassembles content + usage', () => {
    const raw = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      '',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const r = reassembleSse(raw, 'openai');
    expect(r.text).toBe('Hello');
    expect(r.finishReason).toBe('stop');
    expect(r.usage?.total_tokens).toBe(5);
    expect(r.chunks).toBe(4);
  });

  it('reassembles tool_calls across deltas', () => {
    const raw = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"t1","function":{"name":"foo","arguments":"{\\"a\\":"}}]}}]}',
      '',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const r = reassembleSse(raw, 'openai');
    expect(Array.isArray(r.toolCalls)).toBe(true);
    expect((r.toolCalls as any)[0].args).toBe('{"a":1}');
  });
});

describe('reassembleSse anthropic', () => {
  it('reassembles content_block_delta + usage from message_start', () => {
    const raw = [
      'event: message_start',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi "}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
      '',
    ].join('\n');
    const r = reassembleSse(raw, 'anthropic');
    expect(r.text).toBe('Hi there');
    expect(r.finishReason).toBe('end_turn');
    expect(r.usage?.prompt_tokens).toBe(10);
    expect(r.usage?.completion_tokens).toBe(5);
    expect(r.usage?.total_tokens).toBe(15);
  });
});

describe('reassembleSse google', () => {
  it('reassembles candidates parts + usageMetadata', () => {
    const raw = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":2,"totalTokenCount":5}}',
      '',
    ].join('\n');
    const r = reassembleSse(raw, 'google');
    expect(r.text).toBe('Hello');
    expect(r.finishReason).toBe('STOP');
    expect(r.usage?.total_tokens).toBe(5);
  });
});
