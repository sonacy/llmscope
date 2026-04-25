import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadPaths } from '../paths';

export function rotateToken(): { path: string; token: string } {
  const paths = loadPaths();
  mkdirSync(dirname(paths.tokenPath), { recursive: true });
  const tok = randomBytes(32).toString('hex');
  writeFileSync(paths.tokenPath, tok + '\n', { mode: 0o600 });
  try {
    chmodSync(paths.tokenPath, 0o600);
  } catch {
    /* */
  }
  console.log(`rotated token at: ${paths.tokenPath}`);
  console.log('Restart the daemon to pick up the new token: llmscope stop && llmscope start');
  return { path: paths.tokenPath, token: tok };
}
