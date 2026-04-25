---
date: 2026-04-25
feature: llmscope
category: whistle
symptoms: plugin not firing for matched traffic; ~/.llmscope/plugin.log empty
root_cause: chain of three independent gotchas in whistle-client + plugin protocol + Node fetch
---

# Capturing Claude Code through whistle-client + lack + llmscope

## Symptoms

User configured rules in whistle-client (`api.openai.com llmscope://`),
saw the plugin "Active" in the Plugins tab, sent traffic via curl/Node —
nothing landed in the dashboard, and `~/.llmscope/plugin.log` didn't
exist. Whistle's own Network tab showed traffic for curl-via-proxy, but
nothing for Claude Code or `node -e "fetch(...)"`.

## Root Causes (three compounding bugs)

### 1. Plugin's `<plugin>://` rule needs a `server` export, not just `statsServer`

Whistle's `lib/plugins/load-plugin.js:1611`:

```js
var startServer = getFunction(execPlugin.pluginServer || execPlugin.server || execPlugin);
```

When a rule pattern is `<plugin>://`, whistle dispatches matched traffic to
`server`, not `statsServer`. The original plugin only exported
`statsServer`, so whistle had nothing to dispatch matched traffic to —
the rule was a silent no-op. `statsServer` only fires AFTER `server`
processes the request.

### 2. Whistle's `server` hook receives requests as plain HTTP — no HTTPS flag

`x-whistle-https-request` is set in `reqRead`/`resRead` pipe hooks but
NOT in the `server` (protocol) hook. The plugin defaulted upstream to
`http://api.anthropic.com/...` and Anthropic correctly responded
"this request was sent over HTTP". Solution: maintain an allowlist of
known-HTTPS LLM provider hosts (api.openai.com, api.anthropic.com, etc.)
and always forward as HTTPS for matched hosts.

### 3. Node's built-in `fetch()` ignores `HTTPS_PROXY` by default

Node 22.10+ requires `NODE_USE_ENV_PROXY=1` to make undici (the engine
behind `fetch()`) honor `HTTP_PROXY`/`HTTPS_PROXY` env vars. Without it,
every Node CLI silently bypasses the proxy and hits the upstream
directly — which is why Claude Code, Cursor, Codex etc. don't appear in
whistle even when system proxy is set.

## Solution

### Plugin (commits `5c8dcf8`, `d1e7014`, `1169897`)

```js
module.exports.server = function (httpServer) {
  httpServer.on('request', (clientReq, clientRes) => {
    // Tee for body capture without racing the pipe
    const reqTee = new PassThrough();
    clientReq.pipe(reqTee);
    reqTee.on('data', /* buffer */);
    // Default to HTTPS for known LLM hosts; whistle doesn't pass the flag here
    const isHttps = isLikelyHttps(host, clientReq.headers);
    const lib = isHttps ? https : http;
    const upstreamReq = lib.request({...}, ...);
    reqTee.pipe(upstreamReq);
  });
};
```

### Node CLI shell setup (docs/whistle-testing.md)

```sh
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:8888
export NODE_EXTRA_CA_CERTS=$HOME/.WhistleAppData/.whistle/certs/root.crt
```

## Prevention

- When writing plugins for any debugging proxy, read the loader source
  to confirm which hook fires for which rule pattern. Documentation lies;
  source code doesn't.
- For Node-based clients, the `HTTPS_PROXY` env var alone is misleading.
  Always pair with `NODE_USE_ENV_PROXY=1` (Node 22.10+) or use a wrapper
  like `global-agent`.
- When piping through a transformer in Node streams, attach `'data'`
  listeners only to a `PassThrough` you control, never directly to the
  source stream — the listener flips the stream to flowing mode and
  races subsequent `pipe()` wiring.
