import { describe, it, expect } from 'bun:test';
import { attribute, uaFromHeaders, hostFromUrl, BUILTIN_FINGERPRINTS, type Fingerprint } from '../src/fingerprints.ts';

describe('attribute', () => {
  it('identifies Claude Code from UA prefix', () => {
    const s = attribute({ ua: 'claude-cli/0.5.7 (darwin; arm64)', host: 'api.anthropic.com' });
    expect(s.kind).toBe('claude-code');
    expect(s.confidence).toBeGreaterThan(0.9);
  });

  it('identifies Cursor by host', () => {
    const s = attribute({ ua: 'unknown-ua', host: 'api2.cursor.sh' });
    expect(s.kind).toBe('cursor');
  });

  it('identifies Codex CLI', () => {
    const s = attribute({ ua: 'OpenAI/Codex-CLI 0.1.0', host: 'api.openai.com' });
    expect(s.kind).toBe('codex');
  });

  it('falls back to browser for generic UA', () => {
    const s = attribute({ ua: 'Mozilla/5.0 Chrome/120', host: 'example.com' });
    expect(s.kind).toBe('browser');
  });

  it('falls back to unknown when nothing matches', () => {
    const s = attribute({ ua: 'totally-unknown', host: 'some.example' });
    expect(s.kind).toBe('unknown');
    expect(s.confidence).toBe(0);
  });

  it('user-defined rule wins over built-in', () => {
    const fps: Fingerprint[] = [
      { match_type: 'ua_prefix', pattern: 'claude-cli/', kind: 'my-claude', label: 'My Claude', confidence: 0.99, user_defined: true },
      ...BUILTIN_FINGERPRINTS,
    ];
    const s = attribute({ ua: 'claude-cli/0.5', host: 'api.anthropic.com' }, fps);
    expect(s.kind).toBe('my-claude');
  });
});

describe('helpers', () => {
  it('uaFromHeaders is case-insensitive-ish', () => {
    expect(uaFromHeaders({ 'user-agent': 'foo' })).toBe('foo');
    expect(uaFromHeaders({ 'User-Agent': 'bar' })).toBe('bar');
    expect(uaFromHeaders({})).toBe('');
  });
  it('hostFromUrl extracts hostname', () => {
    expect(hostFromUrl('https://api.openai.com/v1/x')).toBe('api.openai.com');
    expect(hostFromUrl('not a url')).toBe('');
  });
});
