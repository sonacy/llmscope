import { mkdirSync, copyFileSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPaths } from '../paths';

function sourceAddonPath(): string {
  if (process.env.LLMSCOPE_MITMPROXY_ADDON) return process.env.LLMSCOPE_MITMPROXY_ADDON;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', '..', 'llmscope-mitmproxy', 'addon.py');
}

export function installMitmproxy(): { path: string; instructions: string[] } {
  const paths = loadPaths();
  mkdirSync(paths.homeDir, { recursive: true });
  const dest = join(paths.homeDir, 'mitmproxy_addon.py');
  const src = sourceAddonPath();
  if (!existsSync(src)) {
    throw new Error(`mitmproxy addon source not found at ${src} (set LLMSCOPE_MITMPROXY_ADDON to override)`);
  }
  copyFileSync(src, dest);
  try {
    chmodSync(dest, 0o755);
  } catch {
    /* */
  }
  const instructions = [
    `Installed addon to: ${dest}`,
    `Run: mitmdump -s ${dest}`,
    `Set LLMSCOPE_TOKEN env var to the daemon's token (or use the file at ~/.llmscope/token).`,
  ];
  for (const line of instructions) console.log(line);
  return { path: dest, instructions };
}
