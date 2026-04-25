import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { takePidFile, releasePidFile, installShutdownHandlers } from '../src/lifecycle';
import { openLogger } from '../src/log';

describe('takePidFile / releasePidFile', () => {
  it('takes when no file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-pid-'));
    const path = join(dir, 'daemon.pid');
    const r = takePidFile(path);
    expect(r.pid).toBe(process.pid);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8').trim()).toBe(String(process.pid));
    releasePidFile(path);
    expect(existsSync(path)).toBe(false);
  });

  it('cleans up stale PID file (process not alive)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-pid-'));
    const path = join(dir, 'daemon.pid');
    writeFileSync(path, '999999999\n');
    const r = takePidFile(path);
    expect(r.cleanedStale).toBe(true);
    expect(readFileSync(path, 'utf8').trim()).toBe(String(process.pid));
    releasePidFile(path);
  });

  it('release does not delete file owned by another pid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-pid-'));
    const path = join(dir, 'daemon.pid');
    writeFileSync(path, '12345\n');
    releasePidFile(path);
    expect(existsSync(path)).toBe(true);
  });
});

describe('installShutdownHandlers', () => {
  it('triggers shutdown closures and removes PID file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-shutdown-'));
    const pidPath = join(dir, 'daemon.pid');
    takePidFile(pidPath);
    let serverClosed = false;
    let dbClosed = false;
    const handler = installShutdownHandlers({
      pidPath,
      closeServer: async () => {
        serverClosed = true;
      },
      closeDb: () => {
        dbClosed = true;
      },
    });
    await handler.trigger();
    expect(serverClosed).toBe(true);
    expect(dbClosed).toBe(true);
    expect(existsSync(pidPath)).toBe(false);
  });
});

describe('openLogger', () => {
  it('writes JSON-line entries with trimmed long fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'llmscope-log-'));
    const path = join(dir, 'daemon.log');
    const logger = openLogger(path);
    logger.info('hello', { detail: 'x'.repeat(500) });
    logger.error('boom');
    logger.close();
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    const first = JSON.parse(lines[0]!);
    expect(first.msg).toBe('hello');
    expect(first.level).toBe('info');
    expect(typeof first.detail).toBe('string');
    expect(first.detail.length).toBeLessThanOrEqual(201);
    const second = JSON.parse(lines[1]!);
    expect(second.level).toBe('error');
  });
});
