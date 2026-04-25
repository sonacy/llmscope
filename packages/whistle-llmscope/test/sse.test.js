'use strict';

const { describe, it, expect } = require('bun:test');
const { reassembleSse, parseFrames, detectProviderFromHost } = require('../src/sse-collector');
const { decode } = require('../src/decompress');
const zlib = require('node:zlib');

describe('parseFrames', () => {
  it('splits on blank lines and parses event/data', () => {
    const raw = ['event: x', 'data: 1', '', 'data: 2', ''].join('\n');
    const frames = parseFrames(raw);
    expect(frames.length).toBe(2);
    expect(frames[0].event).toBe('x');
    expect(frames[0].data).toBe('1');
    expect(frames[1].data).toBe('2');
  });
});

describe('reassembleSse openai', () => {
  it('reassembles delta content + usage + finish reason', () => {
    const raw = [
      'data: {"choices":[{"delta":{"content":"Hi "}}]}', '',
      'data: {"choices":[{"delta":{"content":"there"}}]}', '',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}', '',
      'data: [DONE]', '',
    ].join('\n');
    const r = reassembleSse(raw, 'openai');
    expect(r.text).toBe('Hi there');
    expect(r.finishReason).toBe('stop');
    expect(r.usage.total_tokens).toBe(5);
  });
});

describe('reassembleSse anthropic', () => {
  it('reassembles content_block_delta + message_start usage', () => {
    const raw = [
      'event: message_start', 'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}', '',
      'event: content_block_delta', 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}', '',
      'event: message_delta', 'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}', '',
    ].join('\n');
    const r = reassembleSse(raw, 'anthropic');
    expect(r.text).toBe('Hello');
    expect(r.finishReason).toBe('end_turn');
    expect(r.usage.total_tokens).toBe(13);
  });
});

describe('detectProviderFromHost', () => {
  it('identifies openai/anthropic/google', () => {
    expect(detectProviderFromHost('api.openai.com')).toBe('openai');
    expect(detectProviderFromHost('api.anthropic.com')).toBe('anthropic');
    expect(detectProviderFromHost('generativelanguage.googleapis.com')).toBe('google');
    expect(detectProviderFromHost('example.com')).toBe('unknown');
  });
});

describe('decompress', () => {
  it('passes identity through', () => {
    expect(decode(Buffer.from('hi'), 'identity').toString()).toBe('hi');
    expect(decode(Buffer.from('hi'), '').toString()).toBe('hi');
  });
  it('decodes gzip', () => {
    const z = zlib.gzipSync(Buffer.from('hello'));
    expect(decode(z, 'gzip').toString()).toBe('hello');
  });
  it('decodes br', () => {
    const z = zlib.brotliCompressSync(Buffer.from('hello'));
    expect(decode(z, 'br').toString()).toBe('hello');
  });
});
