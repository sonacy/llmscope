import { mkdirSync, copyFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPaths } from '../paths';

function sourceDir(): string {
  if (process.env.LLMSCOPE_WHISTLE_SRC) return process.env.LLMSCOPE_WHISTLE_SRC;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', '..', 'whistle-llmscope');
}

export function installWhistle(): { dest: string; files: string[]; instructions: string[] } {
  const paths = loadPaths();
  const dest = join(paths.homeDir, 'whistle.llmscope');
  mkdirSync(dest, { recursive: true });
  mkdirSync(join(dest, 'src'), { recursive: true });

  const src = sourceDir();
  const pkgPath = join(src, 'package.json');
  const srcDir = join(src, 'src');
  if (!existsSync(pkgPath) || !existsSync(srcDir)) {
    throw new Error(`whistle plugin source not found at ${src} (set LLMSCOPE_WHISTLE_SRC to override)`);
  }
  copyFileSync(pkgPath, join(dest, 'package.json'));
  const files: string[] = ['package.json'];
  for (const f of readdirSync(srcDir)) {
    copyFileSync(join(srcDir, f), join(dest, 'src', f));
    files.push(`src/${f}`);
  }
  // Provide a README for the user explaining how to load this plugin into whistle.
  const readme = `# whistle.llmscope (installed)\n\n` +
    `This directory was installed by \`llmscope install whistle\`.\n\n` +
    `Load into whistle:\n\n` +
    `1. cd ${dest}\n` +
    `2. w2 add .\n` +
    `3. Open whistle UI, enable the "llmscope" plugin in your active rule.\n\n` +
    `Captured LLM traffic will be POSTed to the daemon at \`http://127.0.0.1:<port>/api/ingest\`.\n`;
  writeFileSync(join(dest, 'README.md'), readme);
  files.push('README.md');

  const instructions = [
    `Installed plugin to: ${dest}`,
    `Activate it: cd ${dest} && w2 add .`,
    `Then ensure the llmscope daemon is running: llmscope start`,
  ];
  for (const line of instructions) console.log(line);
  return { dest, files, instructions };
}
