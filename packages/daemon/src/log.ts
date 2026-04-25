import { existsSync, mkdirSync, openSync, writeSync, closeSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  close(): void;
}

const FRAGMENT_LIMIT = 200;

function trimFields(fields: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = typeof v === 'string' && v.length > FRAGMENT_LIMIT ? v.slice(0, FRAGMENT_LIMIT) + '…' : v;
  }
  return out;
}

export function openLogger(path: string): Logger {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    closeSync(openSync(path, 'w'));
    try {
      chmodSync(path, 0o600);
    } catch {
      /* */
    }
  }
  const fd = openSync(path, 'a');
  function write(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
    const line = JSON.stringify({ ts: Date.now(), level, msg, ...trimFields(fields) }) + '\n';
    writeSync(fd, line);
  }
  return {
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
    close: () => {
      try {
        closeSync(fd);
      } catch {
        /* */
      }
    },
  };
}
