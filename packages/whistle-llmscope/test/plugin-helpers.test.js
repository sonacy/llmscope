'use strict';

const { describe, it, expect } = require('bun:test');
const mod = require('../src/index');

describe('whistle plugin helpers', () => {
  it('reconstructUrl assembles host + path with https when whistle flag is set', () => {
    const req = {
      url: '/v1/chat/completions',
      headers: { host: 'api.openai.com', 'x-whistle-https-request': '1' },
    };
    expect(mod._reconstructUrl(req)).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('reconstructUrl falls back to http when no https flag', () => {
    const req = { url: '/foo', headers: { host: 'example.com' } };
    expect(mod._reconstructUrl(req)).toBe('http://example.com/foo');
  });

  it('reconstructUrl returns null when host header is missing', () => {
    expect(mod._reconstructUrl({ url: '/x', headers: {} })).toBeNull();
  });

  it('outboundHeaders strips host/connection/content-length and all x-whistle-*', () => {
    const out = mod._outboundHeaders({
      'content-type': 'application/json',
      'user-agent': 'OpenAI/Codex-CLI 1.0',
      host: 'api.openai.com',
      connection: 'keep-alive',
      'content-length': '123',
      'x-whistle-plugin-hook-name_': 'foo',
      'x-whistle-client-id': 'abc',
      'x-whistle-https-request': '1',
    });
    expect(out['content-type']).toBe('application/json');
    expect(out['user-agent']).toBe('OpenAI/Codex-CLI 1.0');
    expect(out.host).toBeUndefined();
    expect(out.connection).toBeUndefined();
    expect(out['content-length']).toBeUndefined();
    expect(out['x-whistle-plugin-hook-name_']).toBeUndefined();
    expect(out['x-whistle-client-id']).toBeUndefined();
    expect(out['x-whistle-https-request']).toBeUndefined();
  });

  it('exposes server, statsServer, and uiServer as functions', () => {
    expect(typeof mod.server).toBe('function');
    expect(typeof mod.statsServer).toBe('function');
    expect(typeof mod.uiServer).toBe('function');
  });
});
