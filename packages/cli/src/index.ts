#!/usr/bin/env bun
import { Command } from 'commander';
import { VERSION } from './version';

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
  program.command('start').description('start the daemon').action(() => {
    console.log('start: not implemented (step 29)');
    process.exitCode = 1;
  });
  program.command('stop').description('stop the daemon').action(() => {
    console.log('stop: not implemented (step 29)');
    process.exitCode = 1;
  });
  program.command('status').description('print daemon status').action(() => {
    console.log('status: not implemented (step 29)');
    process.exitCode = 1;
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
