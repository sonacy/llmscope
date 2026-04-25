import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliPaths {
  homeDir: string;
  pidPath: string;
  tokenPath: string;
  logPath: string;
  dbPath: string;
}

export function loadPaths(env: Record<string, string | undefined> = process.env): CliPaths {
  const homeDir = env.LLMSCOPE_HOME ?? join(homedir(), '.llmscope');
  return {
    homeDir,
    pidPath: env.LLMSCOPE_PID_PATH ?? join(homeDir, 'daemon.pid'),
    tokenPath: env.LLMSCOPE_TOKEN_PATH ?? join(homeDir, 'token'),
    logPath: env.LLMSCOPE_LOG_PATH ?? join(homeDir, 'daemon.log'),
    dbPath: env.LLMSCOPE_DB ?? join(homeDir, 'db.sqlite'),
  };
}

export function defaultPort(env: Record<string, string | undefined> = process.env): number {
  return env.LLMSCOPE_PORT ? Number(env.LLMSCOPE_PORT) : 47821;
}
