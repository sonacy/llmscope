# llmscope

> Local desktop LLM proxy gateway. Captures every LLM API call from any app on your machine — browser, IDEs, CLIs (Claude Code, Cursor, Codex) — and surfaces it in a localhost dashboard with token usage, source-app attribution, and replay.

llmscope rides on a debugging proxy you already trust (whistle or mitmproxy) so it inherits mature TLS interception without shipping its own CA cert. Captured events flow through a local Bun + Hono daemon into SQLite (with FTS5 search) and are rendered by a React + Tailwind dashboard at `http://127.0.0.1:47821`.

## 60-second quickstart

```sh
# 1. Pick the host proxy you already use (or install one):
brew install mitmproxy                # or: npm i -g whistle

# 2. Install llmscope:
git clone https://github.com/sonacy/llmscope.git
cd llmscope && bun install

# 3. Start the daemon:
bun packages/daemon/src/index.ts &

# 4. Install the addon for your proxy:
bun packages/cli/src/index.ts install whistle      # or: install mitmproxy

# 5. Route LLM traffic through the proxy as usual; open the dashboard:
bun packages/cli/src/index.ts open
```

See [`docs/quickstart.md`](docs/quickstart.md) for full step-by-step.

## What you get

- **Source attribution.** UA + request-shape fingerprints identify Claude Code, Cursor, Codex, Aider, ChatGPT-web, Claude-web, and Gemini-web out of the box; user-defined rules layer on top and apply on the *next* ingest (no daemon restart).
- **Streaming reassembled.** SSE deltas (OpenAI, Anthropic, Google) and OpenAI Realtime WS frames are stitched into a single event with usage tokens parsed where the provider returns them.
- **Replay.** One click re-sends a captured request through the daemon. v1 is read-only; editable replay is post-1.0.
- **Cost.** Bundled price snapshot (LiteLLM-shaped) plus a `costUsd()` helper. Models without pricing show up in `unpriced_models` so you know what's missing.
- **Local-only.** Daemon binds `127.0.0.1` only, bearer-auth at `~/.llmscope/token` (mode 0600), Authorization headers masked before storage. No telemetry — see [`docs/security.md`](docs/security.md).

## Status

Pre-alpha. Plan + 50-step build log live in `.claude/plans/2026-04-24-llmscope/`. See [`docs/known-limitations.md`](docs/known-limitations.md) for what doesn't work yet.

## License

MIT — see [`LICENSE`](LICENSE).
