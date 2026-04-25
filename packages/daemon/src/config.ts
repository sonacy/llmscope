import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  homeDir: string;
  dbPath: string;
  tokenPath: string;
  pidPath: string;
  logPath: string;
  host: string;
  port: number;
  bodyCapBytes: number;
  dbCapBytes: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const homeDir = env.LLMSCOPE_HOME ?? join(homedir(), '.llmscope');
  return {
    homeDir,
    dbPath: env.LLMSCOPE_DB ?? join(homeDir, 'db.sqlite'),
    tokenPath: env.LLMSCOPE_TOKEN_PATH ?? join(homeDir, 'token'),
    pidPath: env.LLMSCOPE_PID_PATH ?? join(homeDir, 'daemon.pid'),
    logPath: env.LLMSCOPE_LOG_PATH ?? join(homeDir, 'daemon.log'),
    host: env.LLMSCOPE_HOST ?? '127.0.0.1',
    port: env.LLMSCOPE_PORT ? Number(env.LLMSCOPE_PORT) : 47821,
    bodyCapBytes: env.LLMSCOPE_BODY_CAP ? Number(env.LLMSCOPE_BODY_CAP) : 5 * 1024 * 1024,
    dbCapBytes: env.LLMSCOPE_DB_CAP ? Number(env.LLMSCOPE_DB_CAP) : 1024 * 1024 * 1024,
  };
}
