import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}

export function takePidFile(path: string): { pid: number; cleanedStale: boolean } {
  mkdirSync(dirname(path), { recursive: true });
  let cleanedStale = false;
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8').trim();
    const prev = Number(raw);
    if (Number.isFinite(prev) && prev !== process.pid && isProcessAlive(prev)) {
      throw new Error(`llmscope: another daemon (pid ${prev}) holds ${path}`);
    }
    if (prev !== process.pid) {
      cleanedStale = true;
    }
  }
  writeFileSync(path, String(process.pid) + '\n', { mode: 0o600 });
  return { pid: process.pid, cleanedStale };
}

export function releasePidFile(path: string): void {
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8').trim();
      if (Number(raw) === process.pid) unlinkSync(path);
    }
  } catch {
    /* */
  }
}

export interface ShutdownDeps {
  pidPath: string;
  closeServer?: () => Promise<void> | void;
  closeDb?: () => void;
  closeLogger?: () => void;
  timeoutMs?: number;
}

export function installShutdownHandlers(deps: ShutdownDeps): { trigger(): Promise<void> } {
  let triggered = false;
  async function shutdown() {
    if (triggered) return;
    triggered = true;
    const timeout = setTimeout(() => {
      try {
        deps.closeLogger?.();
      } catch {
        /* */
      }
      process.exit(1);
    }, deps.timeoutMs ?? 5000);
    timeout.unref?.();
    try {
      await deps.closeServer?.();
    } catch {
      /* */
    }
    try {
      deps.closeDb?.();
    } catch {
      /* */
    }
    releasePidFile(deps.pidPath);
    try {
      deps.closeLogger?.();
    } catch {
      /* */
    }
    clearTimeout(timeout);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return { trigger: shutdown };
}
