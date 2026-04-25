#!/usr/bin/env bun
import { Command } from 'commander';
import { VERSION } from './version';
import { readStatus, startDaemon, stopDaemon } from './commands/lifecycle';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function defaultDaemonEntry(): string {
  // resolves to <repo>/packages/daemon/src/index.ts during dev, or to a
  // bundled path post-build (overridable via LLMSCOPE_DAEMON_ENTRY).
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
    console.log('init: not implemented (step 30)');
    process.exitCode = 1;
  });
  program
    .command('install <target>')
    .description('install the addon for whistle or mitmproxy')
    .action((target: string) => {
      console.log(`install ${target}: not implemented (steps 31/32)`);
      process.exitCode = 1;
    });

  program
    .command('start')
    .description('start the daemon')
    .action(() => {
      const r = startDaemon({ daemonEntry: defaultDaemonEntry() });
      if (r.alreadyRunning) {
        console.log(`already running (pid ${r.pid})`);
      } else {
        console.log(`started (pid ${r.pid})`);
      }
    });

  program
    .command('stop')
    .description('stop the daemon')
    .action(() => {
      const r = stopDaemon();
      if (!r.stopped) console.log('not running');
      else console.log(`stopped (pid ${r.pid})`);
    });

  program
    .command('status')
    .description('print daemon status')
    .action(() => {
      const s = readStatus();
      console.log(JSON.stringify(s, null, 2));
      process.exitCode = s.running ? 0 : 1;
    });

  program.command('open').description('open the dashboard in your browser').action(() => {
    console.log('open: not implemented (step 33)');
    process.exitCode = 1;
  });
  program.command('export').description('export captured events as JSONL').action(() => {
    console.log('export: not implemented (step 34)');
    process.exitCode = 1;
  });
  program.command('rotate-token').description('rotate the daemon API token').action(() => {
    console.log('rotate-token: not implemented (step 35)');
    process.exitCode = 1;
  });

  return program;
}

if (import.meta.main) {
  buildProgram().parseAsync(process.argv);
}
