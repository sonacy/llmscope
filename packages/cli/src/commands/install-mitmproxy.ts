import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { loadPaths } from '../paths';

const STUB_ADDON_PY = `#!/usr/bin/env python3
# llmscope mitmproxy addon (STUB — full implementation lands in step 38)
# Running this against mitmdump captures nothing yet; this is a placeholder so
# users following the quickstart get a clear error rather than silent no-op.
import sys
print("llmscope mitmproxy addon stub — full implementation lands in step 38",
      file=sys.stderr)
sys.exit(2)
`;

export function installMitmproxy(): { path: string; instructions: string[] } {
  const paths = loadPaths();
  mkdirSync(paths.homeDir, { recursive: true });
  const dest = join(paths.homeDir, 'mitmproxy_addon.py');
  writeFileSync(dest, STUB_ADDON_PY);
  try {
    chmodSync(dest, 0o755);
  } catch {
    /* */
  }
  const instructions = [
    `Installed addon stub to: ${dest}`,
    `Run: mitmdump -s ${dest}`,
    `Note: this is a STUB. Real capture lands in step 38.`,
  ];
  for (const line of instructions) console.log(line);
  return { path: dest, instructions };
}
