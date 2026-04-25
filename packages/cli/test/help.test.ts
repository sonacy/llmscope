import { describe, it, expect } from 'bun:test';
import { buildProgram } from '../src/index';

describe('llmscope CLI', () => {
  it('has all expected subcommands', () => {
    const cmd = buildProgram();
    const names = cmd.commands.map((c) => c.name());
    for (const want of ['init', 'install', 'start', 'stop', 'status', 'open', 'export', 'rotate-token']) {
      expect(names).toContain(want);
    }
  });

  it('reports a version string', () => {
    const cmd = buildProgram();
    expect(cmd.version()).toMatch(/\d+\.\d+\.\d+/);
  });
});
