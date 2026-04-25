import { describe, it, expect } from 'bun:test';
import { detectProvider, looksLikeLlmBody } from '../src/registry.ts';

describe('detectProvider', () => {
  it('matches openai chat completions', () => {
    expect(detectProvider('https://api.openai.com/v1/chat/completions')).toBe('openai');
  });
  it('matches anthropic messages', () => {
    expect(detectProvider('https://api.anthropic.com/v1/messages')).toBe('anthropic');
  });
  it('matches google generative', () => {
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent')).toBe('google');
  });
  it('matches bedrock', () => {
    expect(detectProvider('https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-5-sonnet/invoke')).toBe('bedrock');
  });
  it('returns unknown for unrelated host', () => {
    expect(detectProvider('https://example.com/api/foo')).toBe('unknown');
  });
  it('returns unknown for malformed url', () => {
    expect(detectProvider('not a url')).toBe('unknown');
  });
});

describe('looksLikeLlmBody', () => {
  it('detects OpenAI chat shape', () => {
    expect(looksLikeLlmBody('{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}')).toBe(true);
  });
  it('detects Anthropic shape', () => {
    expect(looksLikeLlmBody('{"model":"claude-3-5-sonnet","messages":[]}')).toBe(true);
  });
  it('detects Gemini contents shape', () => {
    expect(looksLikeLlmBody('{"model":"gemini-2.5-pro","contents":[]}')).toBe(true);
  });
  it('detects legacy prompt shape', () => {
    expect(looksLikeLlmBody('{"model":"text-davinci-003","prompt":"hi"}')).toBe(true);
  });
  it('rejects non-LLM JSON', () => {
    expect(looksLikeLlmBody('{"foo":"bar"}')).toBe(false);
  });
  it('rejects non-JSON text', () => {
    expect(looksLikeLlmBody('not json')).toBe(false);
  });
  it('rejects null/empty', () => {
    expect(looksLikeLlmBody(null)).toBe(false);
    expect(looksLikeLlmBody('')).toBe(false);
  });
});
