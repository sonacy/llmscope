# Testing llmscope through whistle (whistle-client desktop)

This is the end-to-end procedure for capturing real LLM traffic from
**whistle-client** (the macOS desktop app from `avwo/whistle-client`, not the
`w2` CLI). The chain has many moving parts — read this guide before
re-doing any of them. Each section ends with a verification step; do not
proceed until that step succeeds.

> **Why so many steps?** whistle-client doesn't share storage with `w2`.
> Plugins from npm work via the GUI's Install dialog, but local plugin
> development needs `lack`. And Node-based clients (Claude Code, Cursor,
> Codex, Aider) don't honor `HTTPS_PROXY` by default — you have to opt in.

---

## 0. Prerequisites

- macOS (this guide is mac-specific; Linux differs only in CA cert paths)
- [Bun](https://bun.sh) ≥ 1.1
- [whistle-client](https://github.com/avwo/whistle-client) installed
  (downloaded as `Whistle.app`)
- Node ≥ 22.10 — required for `NODE_USE_ENV_PROXY=1` support. Check:
  ```sh
  node --version
  ```
- llmscope cloned + installed:
  ```sh
  git clone https://github.com/sonacy/llmscope.git
  cd llmscope && bun install
  ```

---

## 1. Start the llmscope daemon

```sh
bun packages/daemon/src/index.ts
```

**Verify:**

```sh
curl -s http://127.0.0.1:47821/api/health | head -c 200
# → {"ok":true,"version":"0.0.0",...,"events_today":0,...}

ls -la ~/.llmscope/token
# → -rw------- ... mode 0600
```

Leave the daemon running in this terminal. All subsequent steps assume
this is up.

---

## 2. Mount the whistle plugin via `lack watch`

whistle-client's GUI **Install** dialog only accepts published npm
package names (it runs `w2 install <name>` under the hood). For local
development, use whistle's official scaffold tool, `lack`:

```sh
# One-time, globally:
npm install -g lack

# Each dev session:
bun packages/cli/src/index.ts install whistle   # copies plugin to ~/.llmscope/whistle.llmscope
cd ~/.llmscope/whistle.llmscope
lack watch
```

`lack watch` writes a pointer file at
`~/.WhistleAppData/dev_plugins/whistle.llmscope` containing the source
directory path. whistle-client reads `dev_plugins/` at startup.

**Leave `lack watch` running** in this terminal.

**Verify the pointer file:**

```sh
cat ~/.WhistleAppData/dev_plugins/whistle.llmscope
# → <timestamp>
#   /Users/<you>/.llmscope/whistle.llmscope
```

---

## 3. (Re)launch whistle-client and load the plugin

> **Critical:** whistle-client forks each plugin into a child process at
> startup. Code changes via `lack watch` need a full app restart to take
> effect, NOT just a window reload.

```sh
# From the macOS dock or:
open /Applications/Whistle.app
```

In whistle-client → **Plugins** tab (left sidebar):

- You should see `llmscope` listed alongside `proxyauth` (or whatever
  else is preinstalled).
- The **Active** checkbox should be on.

**Verify the plugin loaded by tailing its log:**

```sh
tail -f ~/.llmscope/plugin.log
# Expect at least one entry of {"label":"module.load",...}
# After making any traffic: server.attach, server.request, server.complete, server.ingest
```

If `plugin.log` doesn't exist after restart: the plugin's child process
didn't load. Quit whistle-client fully (Cmd-Q, not just close window),
restart `lack watch` if necessary, relaunch whistle-client.

---

## 4. Add capture rules

In whistle-client → **Rules** tab → edit your active rule (default name:
`Default`). Add:

```
api.openai.com llmscope://
api.anthropic.com llmscope://
generativelanguage.googleapis.com llmscope://
api2.cursor.sh llmscope://
```

Save and ensure the rule is checked.

**Why a rule is required:** whistle's `<plugin>://` protocol pattern is
what tells whistle to dispatch matched traffic to your plugin's `server`
hook. Without a matching rule, whistle never invokes the plugin —
regardless of whether the **Active** checkbox is on in the Plugins tab.

---

## 5. Turn whistle ON + install its CA cert

In whistle-client's top toolbar:

1. Click the red **ON** button — title bar should change from
   "Not Set As System Proxy" to just the app name. This sets whistle on
   port 8888 as the macOS system proxy.
2. Click the **HTTPS** button. It will walk you through downloading and
   trusting whistle's root CA in macOS Keychain. **Mandatory** — without
   this, every HTTPS API call is opaque bytes.

**Verify both:**

```sh
# Confirm the proxy port:
curl -x http://127.0.0.1:8888 https://example.com -s -o /dev/null -w "%{http_code}\n"
# → 200

# Confirm the CA cert path exists (it's used in step 7):
ls -la ~/.WhistleAppData/.whistle/certs/root.crt
# → -rw-r--r-- ... root.crt
```

**Verify capture works for browser/curl traffic:**

```sh
curl -x http://127.0.0.1:8888 https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hi"}]}' \
  --max-time 10
```

Open `http://127.0.0.1:47821/?t=$(cat ~/.llmscope/token)` — the request
should appear in the events list within a second.

If it doesn't appear:
- Tail `~/.llmscope/plugin.log` while making the request. You should see
  `server.request` and `server.complete` entries.
- If those don't appear, the rule isn't matching. Confirm the rule is
  saved and the rule list is checked.

---

## 6. (Optional) Set up the dashboard URL

The dashboard at `http://127.0.0.1:47821/` reads the token from
`sessionStorage`. The first time you load it, pass the token via query
string:

```sh
open "http://127.0.0.1:47821/?t=$(cat ~/.llmscope/token)"
```

The UI strips `?t=...` from the URL after saving to sessionStorage.
Subsequent loads just need `http://127.0.0.1:47821/`.

---

## 7. Route Node-based clients (Claude Code, Cursor, Codex, Aider)

> **The gotcha that wastes the most time.** Node's built-in `fetch()`
> (the engine behind every modern Node CLI) does NOT honor
> `HTTPS_PROXY` by default. Setting only `HTTPS_PROXY` is silently
> useless. You must also set `NODE_USE_ENV_PROXY=1` (Node 22.10+
> feature). Plus `NODE_EXTRA_CA_CERTS` so Node trusts whistle's
> intercepted TLS certs.

In whatever shell you launch Claude Code (or any Node CLI) from:

```sh
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:8888
export HTTP_PROXY=http://127.0.0.1:8888
export NODE_EXTRA_CA_CERTS=$HOME/.WhistleAppData/.whistle/certs/root.crt
```

To make permanent for every shell, add to `~/.zshrc`. To use only when
needed, save as a function:

```sh
# in ~/.zshrc
llmscope-shell() {
  export NODE_USE_ENV_PROXY=1
  export HTTPS_PROXY=http://127.0.0.1:8888
  export HTTP_PROXY=http://127.0.0.1:8888
  export NODE_EXTRA_CA_CERTS=$HOME/.WhistleAppData/.whistle/certs/root.crt
  echo "Node fetch will now route through whistle. Run 'unllmscope-shell' to undo."
}
unllmscope-shell() {
  unset NODE_USE_ENV_PROXY HTTPS_PROXY HTTP_PROXY NODE_EXTRA_CA_CERTS
  echo "Reset."
}
```

Then `llmscope-shell && claude`.

**Verify Node fetch is going through whistle:**

```sh
NODE_USE_ENV_PROXY=1 \
HTTPS_PROXY=http://127.0.0.1:8888 \
NODE_EXTRA_CA_CERTS=$HOME/.WhistleAppData/.whistle/certs/root.crt \
  node -e "fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'content-type':'application/json','x-api-key':'fake'}, body:'{}'}).then(r => r.text()).then(t => console.log(t.slice(0,200)))"
```

Expected: a real Anthropic 401 response (`invalid x-api-key`). The
request should appear in BOTH whistle's Network tab AND the llmscope
dashboard.

If the request reaches Anthropic but doesn't show in whistle: you forgot
`NODE_USE_ENV_PROXY=1`. Re-export and try again.

---

## 8. Now run Claude Code

```sh
# In the same shell where the env vars are set:
claude
```

Chat with it. Every model call (request and response) appears in the
llmscope dashboard within a second of completion.

---

## Troubleshooting tree

### Symptom: dashboard is empty after a curl test through whistle

Check in order:

1. **Daemon healthy?**
   ```sh
   curl -s http://127.0.0.1:47821/api/health | head -c 200
   ```
   `events_today` should bump after each captured request. If the daemon
   returns errors, check `~/.llmscope/daemon.log`.

2. **Plugin loaded?**
   ```sh
   tail -20 ~/.llmscope/plugin.log
   ```
   Expect `module.load`, `server.attach`. If the log file doesn't
   exist, the plugin's child process never loaded. Quit whistle-client
   fully (Cmd-Q), restart `lack watch`, relaunch whistle-client.

3. **Plugin received the request?**
   With the log tailing, make a request. Expect `server.request` and
   `server.complete` entries. If those don't appear, the rule isn't
   matching the request — confirm in whistle-client's Rules tab that
   the rule is saved and checked.

4. **Plugin posted to daemon?**
   Look for `server.ingest` with `ok:true, status:201`. If you see
   `ok:false`, the daemon is unreachable from the plugin process —
   check the daemon is on port 47821 (default) and the token at
   `~/.llmscope/token` matches.

### Symptom: Claude Code reaches Anthropic but bypasses whistle

Almost certainly `NODE_USE_ENV_PROXY=1` is missing from your shell.
Verify:

```sh
echo "NODE_USE_ENV_PROXY=$NODE_USE_ENV_PROXY"
echo "HTTPS_PROXY=$HTTPS_PROXY"
```

Both must be set in the shell where you launched Claude Code.

### Symptom: `request was sent over HTTP` from Anthropic/OpenAI

Plugin forwarded plaintext upstream. This was a bug fixed in commit
`d1e7014`; the plugin now defaults to HTTPS for known LLM hosts. If
you see this on a different host, add it to `KNOWN_HTTPS_HOSTS` in
`packages/whistle-llmscope/src/index.js`.

### Symptom: TLS error in Node — `unable to verify the first certificate`

`NODE_EXTRA_CA_CERTS` isn't set or points at the wrong file. The path
is `~/.WhistleAppData/.whistle/certs/root.crt` for whistle-client (NOT
`~/.whistle/...` which is the `w2` CLI variant).

### Symptom: plugin shows in Plugins tab but log file empty after restart

`lack watch` has stopped (likely you Ctrl-C'd it). Restart it:

```sh
cd ~/.llmscope/whistle.llmscope && lack watch
```

Then quit + relaunch whistle-client.

### Symptom: `EADDRINUSE :47821` when starting daemon

Another daemon is running. Either:

```sh
bun packages/cli/src/index.ts stop
# or:
lsof -i :47821        # find the PID
kill <pid>
```

---

## Reference: which directories does what

| Path | Purpose |
|---|---|
| `~/.llmscope/db.sqlite` | event store (SQLite + FTS5) |
| `~/.llmscope/token` | bearer token, mode 0600 |
| `~/.llmscope/daemon.pid` | running daemon PID |
| `~/.llmscope/daemon.log` | daemon JSON-line log |
| `~/.llmscope/plugin.log` | whistle plugin diagnostic log |
| `~/.llmscope/whistle.llmscope/` | plugin source (copied from repo by `install whistle`) |
| `~/.WhistleAppData/.whistle/certs/root.crt` | whistle's root CA cert |
| `~/.WhistleAppData/dev_plugins/whistle.llmscope` | lack's pointer file → plugin source |
| `~/.WhistleAppData/custom_plugins/` | npm-installed whistle plugins (not used here) |

## Security note

Captured request bodies often contain prompts, customer data, and
sometimes API keys (we mask `Authorization`, `x-api-key`,
`anthropic-api-key`, etc., but only at known header positions — values
embedded in request bodies are NOT masked). Treat
`~/.llmscope/db.sqlite` as a debug log: its contents are as sensitive
as your prompts.

If you accidentally pasted an API key into a chat or shared the DB,
rotate the key immediately at the provider's console.
