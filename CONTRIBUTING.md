# Contributing to llmscope

## Repo layout

Bun workspaces:

```
packages/
  core/                 shared zod schemas, attribution, reassembly, masking, pricing
  daemon/               Hono + bun:sqlite ingest + dashboard server
  cli/                  llmscope CLI
  ui/                   React + Vite + Tailwind dashboard
  whistle-llmscope/     whistle plugin (Node CJS)
  llmscope-mitmproxy/   single-file mitmproxy addon (Python, stdlib-only)
tests/e2e/              end-to-end smoke
.claude/plans/          PRD, architecture, plan
```

## Local dev

```sh
bun install
bun run typecheck     # all packages
bun test              # all packages, all tests
bun run --filter '@llmscope/ui' build   # builds UI into packages/daemon/public
bun packages/daemon/src/index.ts        # boot the daemon at :47821
```

## Single-package commands

```sh
bun test packages/core
bun test packages/daemon
bun test packages/cli
bun test packages/whistle-llmscope
bun test tests/e2e
```

## Python addon tests

The mitmproxy addon is pure stdlib; pytest is the test runner:

```sh
pip install pytest
pytest packages/llmscope-mitmproxy/test/
```

If you don't have pytest, the test file's helpers are all importable via `importlib`; run the assertions in a quick `python3 -c` snippet — see CI workflow for the canonical invocation.

## Wiring whistle for live dev

1. `bun packages/cli/src/index.ts install whistle`
2. `cd ~/.llmscope/whistle.llmscope && w2 add .`
3. Toggle the "llmscope" plugin in your active rule.
4. Send traffic, check `bun packages/cli/src/index.ts status`.

Plugin source lives at `packages/whistle-llmscope/src/`; the install command copies the whole `src/` tree, so re-running `install whistle` after edits picks up changes.

## Wiring mitmproxy for live dev

```sh
LLMSCOPE_TOKEN=$(cat ~/.llmscope/token) \
  mitmdump -s packages/llmscope-mitmproxy/addon.py
```

Editing `addon.py` is hot — restart `mitmdump` after changes.

## Conventions

- Branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>`.
- Commits follow `<type>(<scope>): <description> [step <id>/50]` while the initial 50-step plan is in flight; after that, plain conventional commits.
- All TypeScript code typechecks under `--strict --noUncheckedIndexedAccess`.
- Tests live next to source (`packages/<pkg>/test/*.test.ts`) or in `tests/e2e/`.
- Don't add ESLint plugins beyond `eslint:recommended` without discussion — we keep the toolchain minimal.

## Architecture decisions

See `.claude/plans/2026-04-24-llmscope/architecture.md` for the locked-in v1 design (six-package monorepo, addon contract, security model, streaming reassembly per provider). The PRD is at `prd.md`. The 50-step build plan is at `plan.md`.
