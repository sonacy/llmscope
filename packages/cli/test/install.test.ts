import { describe, it, expect } from 'bun:test';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installWhistle } from '../src/commands/install-whistle';
import { installMitmproxy } from '../src/commands/install-mitmproxy';
import { rotateToken } from '../src/commands/rotate-token';
import { detectProxies } from '../src/commands/init';

describe('installWhistle', () => {
  it('copies plugin source into ~/.llmscope/whistle.llmscope', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-iw-'));
    process.env.LLMSCOPE_HOME = dir;
    const r = installWhistle();
    expect(r.dest).toBe(join(dir, 'whistle.llmscope'));
    expect(existsSync(join(r.dest, 'package.json'))).toBe(true);
    expect(existsSync(join(r.dest, 'src', 'index.js'))).toBe(true);
    expect(existsSync(join(r.dest, 'README.md'))).toBe(true);
    delete process.env.LLMSCOPE_HOME;
  });
});

describe('installMitmproxy', () => {
  it('copies the real addon.py with mitmproxy hooks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-im-'));
    process.env.LLMSCOPE_HOME = dir;
    const r = installMitmproxy();
    expect(r.path).toBe(join(dir, 'mitmproxy_addon.py'));
    const content = readFileSync(r.path, 'utf8');
    expect(content).toContain('#!/usr/bin/env python3');
    expect(content).toContain('class LlmscopeAddon');
    expect(content).toContain('def response(self, flow)');
    expect(content).toContain('def websocket_message(self, flow)');
    delete process.env.LLMSCOPE_HOME;
  });
});

describe('rotateToken', () => {
  it('writes a 64-hex token to the token path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-rt-'));
    process.env.LLMSCOPE_HOME = dir;
    const r = rotateToken();
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(r.path, 'utf8').trim()).toBe(r.token);
    delete process.env.LLMSCOPE_HOME;
  });
});

describe('detectProxies', () => {
  it('returns booleans + path strings or null', () => {
    const r = detectProxies();
    expect(typeof r.whistle).toBe('boolean');
    expect(typeof r.mitmproxy).toBe('boolean');
  });
});
