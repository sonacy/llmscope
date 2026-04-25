import { execFileSync } from 'node:child_process';
import { defaultPort } from '../paths';

export function openDashboard(): { url: string; opened: boolean } {
  const url = `http://127.0.0.1:${defaultPort()}/`;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    execFileSync(cmd, [url], { stdio: 'ignore' });
    console.log(`opening ${url}`);
    return { url, opened: true };
  } catch {
    console.log(`open it manually: ${url}`);
    return { url, opened: false };
  }
}
