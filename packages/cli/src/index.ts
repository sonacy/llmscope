#!/usr/bin/env bun
import { Command } from 'commander';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './version';
import { readStatus, startDaemon, stopDaemon } from './commands/lifecycle';
import { runInit } from './commands/init';
import { installWhistle } from './commands/install-whistle';
import { installMitmproxy } from './commands/install-mitmproxy';
import { openDashboard } from './commands/open';
import { runExport } from './commands/export';
import { rotateToken } from './commands/rotate-token';

function defaultDaemonEntry(): string {
  if (process.env.LLMSCOPE_DAEMON_ENTRY) return process.env.LLMSCOPE_DAEMON_ENTRY;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'daemon', 'src', 'index.ts');
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('llmscope')
    .description('Local LLM proxy gateway: capture, dashboard, replay')
    .version(VERSION);

  program.command('init').description('detect host proxies and configure llmscope').action(() => {
    runInit();
  });

  program
    .command('install <target>')
    .description('install the addon for whistle or mitmproxy')
    .action((target: string) => {
      if (target === 'whistle') installWhistle();
      else if (target === 'mitmproxy') installMitmproxy();
      else {
        console.error(`unknown target: ${target} (expected: whistle | mitmproxy)`);
        process.exitCode = 2;
      }
    });

  program.command('start').description('start the daemon').action(() => {
    const r = startDaemon({ daemonEntry: defaultDaemonEntry() });
    if (r.alreadyRunning) console.log(`already running (pid ${r.pid})`);
    else console.log(`started (pid ${r.pid})`);
  });

  program.command('stop').description('stop the daemon').action(() => {
    const r = stopDaemon();
    if (!r.stopped) console.log('not running');
    else console.log(`stopped (pid ${r.pid})`);
  });

  program.command('status').description('print daemon status').action(() => {
    const s = readStatus();
    console.log(JSON.stringify(s, null, 2));
    process.exitCode = s.running ? 0 : 1;
  });

  program.command('open').description('open the dashboard in your browser').action(() => {
    openDashboard();
  });

  program
    .command('export')
    .description('export captured events as JSONL to stdout')
    .option('--since <iso>', 'inclusive start (ISO 8601)')
    .option('--until <iso>', 'inclusive end (ISO 8601)')
    .option('--source <kind>', 'filter by source kind')
    .option('--provider <name>', 'filter by provider')
    .action(async (opts: { since?: string; until?: string; source?: string; provider?: string }) => {
      const r = await runExport(opts);
      process.stderr.write(`exported ${r.count} events\n`);
    });

  program.command('rotate-token').description('rotate the daemon API token').action(() => {
    rotateToken();
  });

  return program;
}

if (import.meta.main) {
  buildProgram().parseAsync(process.argv);
}
