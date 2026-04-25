'use strict';

const { describe, it, expect } = require('bun:test');
const { shouldCapture, buildEvent, looksLikeLlmHost, looksLikeLlmBody, maskHeaders, MASK_TOKEN } = require('../src/capture');

describe('looksLikeLlmHost', () => {
  it('matches openai/anthropic/google/cursor', () => {
    expect(looksLikeLlmHost('api.openai.com')).toBe(true);
    expect(looksLikeLlmHost('api.anthropic.com')).toBe(true);
    expect(looksLikeLlmHost('generativelanguage.googleapis.com')).toBe(true);
    expect(looksLikeLlmHost('api2.cursor.sh')).toBe(true);
  });
  it('rejects unrelated hosts', () => {
    expect(looksLikeLlmHost('example.com')).toBe(false);
    expect(looksLikeLlmHost('')).toBe(false);
    expect(looksLikeLlmHost(undefined)).toBe(false);
  });
});

describe('looksLikeLlmBody', () => {
  it('matches OpenAI-shaped JSON', () => {
    expect(looksLikeLlmBody('{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}')).toBe(true);
  });
  it('rejects non-LLM JSON and non-JSON', () => {
    expect(looksLikeLlmBody('{"foo":"bar"}')).toBe(false);
    expect(looksLikeLlmBody('not json')).toBe(false);
    expect(looksLikeLlmBody(null)).toBe(false);
  });
});

describe('shouldCapture', () => {
  it('captures via host', () => {
    expect(shouldCapture({ host: 'api.openai.com', requestBody: null })).toBe(true);
  });
  it('captures via body shape on unknown host', () => {
    expect(shouldCapture({ host: 'private.proxy.example', requestBody: '{"model":"m","messages":[]}' })).toBe(true);
  });
  it('skips unrelated traffic', () => {
    expect(shouldCapture({ host: 'cdn.example.com', requestBody: '{"foo":1}' })).toBe(false);
  });
});

describe('buildEvent + masking', () => {
  it('masks Authorization in stored headers', () => {
    const ev = buildEvent({
      tsStart: 1, tsEnd: 2,
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      requestHeaders: { authorization: 'Bearer sk-leak', 'user-agent': 'OpenAI/Codex-CLI' },
      requestBody: '{"model":"gpt-4o","messages":[]}',
      status: 200,
      responseHeaders: {},
      responseBody: '',
    });
    expect(ev.request_headers.authorization).toBe(MASK_TOKEN);
    expect(ev.request_headers['user-agent']).toBe('OpenAI/Codex-CLI');
  });

  it('returns http transport with request/response strings', () => {
    const ev = buildEvent({ tsStart: 1, tsEnd: 2, method: 'POST', url: 'https://x/y', requestHeaders: {}, requestBody: 'a', status: 200, responseHeaders: {}, responseBody: 'b' });
    expect(ev.transport).toBe('http');
    expect(ev.request_body).toBe('a');
    expect(ev.response_body).toBe('b');
    expect(ev.status).toBe(200);
  });
});

describe('maskHeaders extras', () => {
  it('handles undefined headers', () => {
    expect(maskHeaders(undefined)).toEqual({});
  });
});
