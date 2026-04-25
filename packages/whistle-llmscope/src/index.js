'use strict';

// whistle.llmscope — captures LLM-shaped HTTP traffic and forwards events to
// the llmscope daemon at http://127.0.0.1:<port>/api/ingest.
//
// Whistle's plugin protocol (verified against whistle 2.10.x source):
//   - Each named export is a function (server, options) => void.
//   - `server` is an http.Server. We listen for 'request' events.
//   - Whistle ONLY invokes plugin hooks for requests matched by a rule. The
//     user must add a rule like `api.openai.com llmscope://` to enable us.
//   - The stats hook fires twice per request: once on req-headers (req-stats),
//     once on response complete (res-stats). We act on res-stats so the row
//     has status + headers populated.
//
// Hook header format: x-whistle-plugin-hook-name_ = "res-stats-<whistleUid>"
// We match on the prefix to be uid-agnostic.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { shouldCapture, buildEvent } = require('./capture');
const { postEvent } = require('./post');

const DEBUG = process.env.LLMSCOPE_DEBUG === '1';
const DEBUG_LOG = path.join(os.homedir(), '.llmscope', 'whistle-debug.log');
const HOOK_HEADER = 'x-whistle-plugin-hook-name_';

function debug(label, payload) {
  if (!DEBUG) return;
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      JSON.stringify({ ts: Date.now(), label, payload }) + '\n',
      { mode: 0o600 },
    );
  } catch {
    /* ignore */
  }
}

function isHook(headers, name) {
  const v = headers[HOOK_HEADER];
  return typeof v === 'string' && v.startsWith(name);
}

function reconstructUrl(req) {
  const host = req.headers.host;
  if (!host) return null;
  const isHttps =
    req.headers['x-whistle-https-request'] === '1' ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-whistle-https-request']; // any truthy value
  const proto = isHttps ? 'https' : 'http';
  return `${proto}://${host}${req.url}`;
}

function publicHeaders(headers) {
  const out = {};
  for (const k of Object.keys(headers)) {
    if (k.startsWith('x-whistle-')) continue;
    if (k === HOOK_HEADER) continue;
    if (k === 'x-forwarded-from-whistle') continue;
    out[k] = headers[k];
  }
  return out;
}

// statsServer fires for every matched request after the response completes.
module.exports.statsServer = function (server) {
  server.on('request', (req, res) => {
    // Whistle expects a fast 200 — anything else delays the user's traffic.
    res.writeHead(200);
    res.end();

    debug('statsServer hit', {
      method: req.method,
      url: req.url,
      hook: req.headers[HOOK_HEADER],
      headers: req.headers,
    });

    if (!isHook(req.headers, 'res-stats')) return;

    const fullUrl = reconstructUrl(req);
    if (!fullUrl) return;
    let host;
    try {
      host = new URL(fullUrl).hostname;
    } catch {
      return;
    }
    if (!shouldCapture({ host, requestBody: null })) {
      debug('skip', { host });
      return;
    }

    // Whistle's stats hook propagates the captured request's *original* method
    // via the inbound request's method (it issues an http.request mirroring
    // method+url+headers). Older whistle issues GET unconditionally — we
    // accept both and log the actual value to debug.
    const method = req.method && req.method !== 'GET' ? req.method : (req.headers['x-whistle-method'] || 'GET');

    const event = buildEvent({
      tsStart: Number(req.headers['x-whistle-start-time']) || Date.now() - 1,
      tsEnd: Date.now(),
      method,
      url: fullUrl,
      requestHeaders: publicHeaders(req.headers),
      requestBody: null, // not in stats payload; reqRead/resRead come later
      status: Number(req.headers['x-whistle-status-code']) || null,
      responseHeaders: {},
      responseBody: null,
    });

    postEvent(event, (err, st) => {
      debug('ingest result', { status: st, error: err && err.message, url: fullUrl });
    });
  });
  server.on('error', (e) => debug('statsServer error', { msg: e.message }));
  debug('statsServer ready', {});
};

// uiServer: tiny landing page reachable via the plugin's UI tab.
module.exports.uiServer = function (server) {
  server.on('request', (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>llmscope</title>
<body style="font-family:system-ui;padding:2rem;color:#222;line-height:1.5">
  <h2 style="margin-top:0">llmscope plugin loaded</h2>
  <p>Add a rule in whistle's <strong>Rules</strong> tab so this plugin sees traffic, e.g.:</p>
  <pre style="background:#f5f5f5;padding:1rem">api.openai.com llmscope://
api.anthropic.com llmscope://
generativelanguage.googleapis.com llmscope://</pre>
  <p>Captured events are forwarded to <code>http://127.0.0.1:47821/api/ingest</code>.
     Open the dashboard at <a href="http://127.0.0.1:47821/" target="_blank">http://127.0.0.1:47821/</a>.</p>
  <p>Set <code>LLMSCOPE_DEBUG=1</code> in whistle's env to log frame parsing to
     <code>~/.llmscope/whistle-debug.log</code>.</p>
</body>`);
  });
};

// Re-exported for in-process tests.
module.exports._isHook = isHook;
module.exports._reconstructUrl = reconstructUrl;
module.exports._publicHeaders = publicHeaders;
module.exports._capture = require('./capture');
module.exports._post = require('./post');
