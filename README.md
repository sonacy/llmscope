# llmscope

Local desktop LLM proxy gateway. Captures LLM API traffic from any app on your machine — browser, IDEs, CLIs (Claude Code, Cursor, Codex) — by injecting an addon into your existing debugging proxy (whistle or mitmproxy). Stores requests/responses with token usage, source-app attribution, and replay.

> Status: pre-alpha. See `.claude/plans/2026-04-24-llmscope/` for PRD, architecture, and implementation plan.

## Layout

```
packages/
  core/                 shared schemas, attribution engine, reassembly, masking, pricing
  daemon/               Hono + bun:sqlite ingest + dashboard server
  cli/                  llmscope CLI
  ui/                   React + Vite + Tailwind + shadcn dashboard
  whistle-llmscope/     whistle plugin (Node)
  llmscope-mitmproxy/   single-file mitmproxy addon (Python)
```

## Development

```sh
bun install
bun run typecheck
bun test
```

## License

MIT — see `LICENSE`.
