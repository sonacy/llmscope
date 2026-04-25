import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadPaths, defaultPort, type CliPaths } from '../paths';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}

export function readPid(paths: CliPaths): number | null {
  if (!existsSync(paths.pidPath)) return null;
  const raw = readFileSync(paths.pidPath, 'utf8').trim();
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return isAlive(n) ? n : null;
}

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  port: number;
  homeDir: string;
  dbSizeBytes: number;
  tokenAvailable: boolean;
}

export function readStatus(): DaemonStatus {
  const paths = loadPaths();
  const pid = readPid(paths);
  let dbSizeBytes = 0;
  try {
    if (existsSync(paths.dbPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { statSync } = require('node:fs') as typeof import('node:fs');
      dbSizeBytes = statSync(paths.dbPath).size;
    }
  } catch {
    /* */
  }
  return {
    running: pid != null,
    pid,
    port: defaultPort(),
    homeDir: paths.homeDir,
    dbSizeBytes,
    tokenAvailable: existsSync(paths.tokenPath),
  };
}

export interface StartOptions {
  daemonEntry: string;
  detached?: boolean;
  env?: NodeJS.ProcessEnv;
}

export function startDaemon(opts: StartOptions): { pid: number | null; alreadyRunning: boolean } {
  const paths = loadPaths(opts.env);
  const existing = readPid(paths);
  if (existing) return { pid: existing, alreadyRunning: true };
  const child = spawn(process.execPath, [opts.daemonEntry], {
    detached: opts.detached ?? true,
    stdio: 'ignore',
    env: opts.env ?? process.env,
  });
  child.unref();
  return { pid: child.pid ?? null, alreadyRunning: false };
}

export function stopDaemon(): { stopped: boolean; pid: number | null } {
  const paths = loadPaths();
  const pid = readPid(paths);
  if (!pid) return { stopped: false, pid: null };
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return { stopped: false, pid };
  }
  return { stopped: true, pid };
}
