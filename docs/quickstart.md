# llmscope quickstart

## 1. Prerequisites

- macOS or Linux. (Windows is best-effort; PID semantics differ.)
- [Bun](https://bun.sh) ≥ 1.1 (`brew install oven-sh/bun/bun`).
- A debugging proxy you already use, or a fresh install:
  - **whistle** (Node, popular in CN): `npm i -g whistle`
  - **mitmproxy** (Python, universal): `brew install mitmproxy` or `pip install mitmproxy`
- Python 3.11+ if you go the mitmproxy path.

## 2. Clone and install

```sh
git clone https://github.com/sonacy/llmscope.git
cd llmscope
bun install
```

## 3. Start the daemon

```sh
bun packages/daemon/src/index.ts
```

It binds `http://127.0.0.1:47821` and writes:

| File | Purpose |
|---|---|
| `~/.llmscope/db.sqlite` | event store (SQLite + FTS5) |
| `~/.llmscope/token` | bearer token, mode 0600 |
| `~/.llmscope/daemon.pid` | for `llmscope stop` / crash recovery |
| `~/.llmscope/daemon.log` | JSON-lines logs |

## 4. Install the addon

### whistle

```sh
bun packages/cli/src/index.ts install whistle
cd ~/.llmscope/whistle.llmscope
w2 add .
# enable the "llmscope" plugin in your active rule from the whistle UI
```

### mitmproxy

```sh
bun packages/cli/src/index.ts install mitmproxy
LLMSCOPE_TOKEN=$(cat ~/.llmscope/token) mitmdump -s ~/.llmscope/mitmproxy_addon.py
```

Then point your apps at `localhost:8080` (mitmproxy's default).

## 5. Open the dashboard

```sh
bun packages/cli/src/index.ts open
```

The token is read from `~/.llmscope/token` automatically when you load `http://127.0.0.1:47821`.

## 6. Make some traffic

Whatever you normally do — Claude Code, Cursor, the OpenAI playground, your own scripts — should now show up in the **events** list within a second of completion. Click into an event to see request/response bodies (with `Authorization` masked), the streaming timeline, parsed token usage, and a one-click **replay** button.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard says "Bootstrap failed" | The token in `~/.llmscope/token` may differ from what the URL/sessionStorage has. Run `bun packages/cli/src/index.ts rotate-token`, restart the daemon, then visit `http://127.0.0.1:47821/?t=<new-token>`. |
| Port 47821 in use | Set `LLMSCOPE_PORT=<other>` before starting the daemon. |
| `FTS5 not available` on daemon start | Your Bun build is missing FTS5. Update Bun ≥ 1.1.0. |
| No events captured | Confirm traffic is going through the proxy (curl with `--proxy http://127.0.0.1:8080 https://api.openai.com/v1/...`); confirm the proxy's CA is trusted (whistle/mitmproxy install instructions). |
| `replay_requires_auth` (409) | The Authorization header was masked at storage time. Re-send the original request from the source app to capture a fresh key. |
