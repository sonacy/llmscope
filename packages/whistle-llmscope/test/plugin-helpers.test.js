'use strict';

const { describe, it, expect } = require('bun:test');
const mod = require('../src/index');

describe('whistle plugin helpers', () => {
  it('isHook matches res-stats prefix regardless of whistle uid suffix', () => {
    expect(mod._isHook({ 'x-whistle-plugin-hook-name_': 'res-stats-19dc321da962d082034' }, 'res-stats')).toBe(true);
    expect(mod._isHook({ 'x-whistle-plugin-hook-name_': 'req-stats-19dc321da962d082034' }, 'res-stats')).toBe(false);
    expect(mod._isHook({}, 'res-stats')).toBe(false);
  });

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

  it('publicHeaders strips internal x-whistle-* and the hook header', () => {
    const out = mod._publicHeaders({
      'content-type': 'application/json',
      'user-agent': 'OpenAI/Codex-CLI 1.0',
      'x-whistle-plugin-hook-name_': 'res-stats-uid',
      'x-whistle-client-id': 'abc',
      'x-whistle-https-request': '1',
    });
    expect(out['content-type']).toBe('application/json');
    expect(out['user-agent']).toBe('OpenAI/Codex-CLI 1.0');
    expect(out['x-whistle-plugin-hook-name_']).toBeUndefined();
    expect(out['x-whistle-client-id']).toBeUndefined();
  });

  it('exposes statsServer and uiServer as functions', () => {
    expect(typeof mod.statsServer).toBe('function');
    expect(typeof mod.uiServer).toBe('function');
  });
});
