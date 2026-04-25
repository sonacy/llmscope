import { execSync } from 'node:child_process';

export interface ProxyDetect {
  whistle: boolean;
  whistlePath: string | null;
  mitmproxy: boolean;
  mitmproxyPath: string | null;
}

function which(bin: string): string | null {
  try {
    const out = execSync(`command -v ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

export function detectProxies(): ProxyDetect {
  const whistlePath = which('w2') ?? which('whistle');
  const mitmproxyPath = which('mitmdump') ?? which('mitmproxy');
  return {
    whistle: whistlePath != null,
    whistlePath,
    mitmproxy: mitmproxyPath != null,
    mitmproxyPath,
  };
}

export function runInit(): { detected: ProxyDetect } {
  const detected = detectProxies();
  console.log('llmscope init — host proxy detection');
  console.log(`  whistle    : ${detected.whistle ? `✓ ${detected.whistlePath}` : '✗ not found'}`);
  console.log(`  mitmproxy  : ${detected.mitmproxy ? `✓ ${detected.mitmproxyPath}` : '✗ not found'}`);
  if (!detected.whistle && !detected.mitmproxy) {
    console.log('\nNo supported proxy found. Install one:');
    console.log('  whistle:    npm i -g whistle');
    console.log('  mitmproxy:  brew install mitmproxy   # or pip install mitmproxy');
  } else {
    const next: string[] = [];
    if (detected.whistle) next.push('llmscope install whistle');
    if (detected.mitmproxy) next.push('llmscope install mitmproxy');
    console.log(`\nNext: run one of:\n  ${next.join('\n  ')}`);
  }
  return { detected };
}
