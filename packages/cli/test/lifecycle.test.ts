import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPid } from '../src/commands/lifecycle';
import { loadPaths } from '../src/paths';

describe('readPid', () => {
  it('returns null when file missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-pid-'));
    process.env.LLMSCOPE_HOME = dir;
    expect(readPid(loadPaths())).toBeNull();
    delete process.env.LLMSCOPE_HOME;
  });

  it('returns null when stale (process not alive)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-pid-'));
    process.env.LLMSCOPE_HOME = dir;
    writeFileSync(join(dir, 'daemon.pid'), '999999999\n');
    expect(readPid(loadPaths())).toBeNull();
    delete process.env.LLMSCOPE_HOME;
  });

  it('returns current pid when alive', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-cli-pid-'));
    process.env.LLMSCOPE_HOME = dir;
    writeFileSync(join(dir, 'daemon.pid'), `${process.pid}\n`);
    expect(readPid(loadPaths())).toBe(process.pid);
    delete process.env.LLMSCOPE_HOME;
  });
});
