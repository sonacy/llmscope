'use strict';

// whistle.llmscope — captures LLM-shaped HTTPS traffic by acting as a
// transparent forward proxy when a rule like `api.openai.com llmscope://`
// matches. Verified against whistle 2.10.x: whistle dispatches matched
// traffic to `module.exports.server` (with `pluginServer` and the bare
// module.exports as legacy fallbacks). statsServer is kept as a secondary
// signal but the `server` export is what actually catches the traffic.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const { shouldCapture, buildEvent } = require('./capture');
const { postEvent } = require('./post');

const HOME = process.env.LLMSCOPE_HOME || path.join(os.homedir(), '.llmscope');
const LOG = path.join(HOME, 'plugin.log');

function log(label, payload) {
  try {
    fs.mkdirSync(HOME, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({ ts: Date.now(), label, payload }) + '\n');
  } catch {
    /* never let the plugin crash on log write */
  }
}

// Module-load marker proves whistle even required us.
log('module.load', { pid: process.pid, node: process.version });

const HOOK_HEADER = 'x-whistle-plugin-hook-name_';
const HTTPS_HEADER = 'x-whistle-https-request';

const STRIP_OUTBOUND = new Set([
  'host',
  'connection',
  'proxy-connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  HOOK_HEADER,
  HTTPS_HEADER,
  'x-forwarded-from-whistle',
]);

function reconstructUrl(req) {
  const host = req.headers.host;
  if (!host) return null;
  const isHttps = !!req.headers[HTTPS_HEADER];
  return `${isHttps ? 'https' : 'http'}://${host}${req.url || '/'}`;
}

function outboundHeaders(headers) {
  const out = {};
  for (const k of Object.keys(headers || {})) {
    const lk = k.toLowerCase();
    if (STRIP_OUTBOUND.has(lk)) continue;
    if (lk.startsWith('x-whistle-')) continue;
    out[k] = headers[k];
  }
  return out;
}

const MAX_BUFFER_BYTES = 5 * 1024 * 1024;

// `server` export: transparent forward proxy + capture. Whistle dispatches
// matched traffic here when the rule pattern is `<plugin>://`. We forward
// to the real upstream and buffer both directions for capture.
module.exports.server = function (httpServer /*, options */) {
  log('server.attach', { type: 'http.Server' });

  httpServer.on('request', (clientReq, clientRes) => {
    const tsStart = Date.now();
    const fullUrl = reconstructUrl(clientReq);
    log('server.request', {
      method: clientReq.method,
      url: fullUrl,
      hostHeader: clientReq.headers.host,
      hook: clientReq.headers[HOOK_HEADER],
      httpsFlag: clientReq.headers[HTTPS_HEADER],
    });

    if (!fullUrl) {
      clientRes.writeHead(400);
      clientRes.end('llmscope: missing host header');
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(fullUrl);
    } catch {
      clientRes.writeHead(400);
      clientRes.end('llmscope: invalid URL');
      return;
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    // Buffer request body for capture.
    const reqChunks = [];
    let reqBytes = 0;
    clientReq.on('data', (chunk) => {
      if (reqBytes < MAX_BUFFER_BYTES) {
        reqChunks.push(chunk);
        reqBytes += chunk.length;
      }
    });

    const upstreamOpts = {
      method: clientReq.method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: outboundHeaders(clientReq.headers),
    };

    const upstreamReq = lib.request(upstreamOpts, (upstreamRes) => {
      try {
        clientRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      } catch (e) {
        log('server.writeHead.error', { msg: e.message });
      }

      const resChunks = [];
      let resBytes = 0;
      upstreamRes.on('data', (chunk) => {
        if (resBytes < MAX_BUFFER_BYTES) {
          resChunks.push(chunk);
          resBytes += chunk.length;
        }
        try {
          clientRes.write(chunk);
        } catch {
          /* client may have disconnected; keep capturing */
        }
      });

      upstreamRes.on('end', () => {
        try {
          clientRes.end();
        } catch {
          /* */
        }

        const reqBody = Buffer.concat(reqChunks).toString('utf8');
        const resBody = Buffer.concat(resChunks).toString('utf8');
        const host = parsedUrl.hostname;

        log('server.complete', {
          status: upstreamRes.statusCode,
          host,
          reqLen: reqBody.length,
          resLen: resBody.length,
        });

        if (!shouldCapture({ host, requestBody: reqBody })) {
          log('server.skip', { host });
          return;
        }

        const event = buildEvent({
          tsStart,
          tsEnd: Date.now(),
          method: clientReq.method,
          url: fullUrl,
          requestHeaders: clientReq.headers,
          requestBody: reqBody || null,
          status: upstreamRes.statusCode || null,
          responseHeaders: upstreamRes.headers,
          responseBody: resBody || null,
        });

        postEvent(event, (err, st) => {
          log('server.ingest', { ok: !err, status: st, error: err && err.message });
        });
      });

      upstreamRes.on('error', (e) => {
        log('server.upstreamRes.error', { msg: e.message });
        try {
          clientRes.end();
        } catch {
          /* */
        }
      });
    });

    upstreamReq.on('error', (e) => {
      log('server.upstreamReq.error', { msg: e.message });
      try {
        clientRes.writeHead(502);
        clientRes.end('llmscope: upstream error: ' + e.message);
      } catch {
        /* */
      }
    });

    clientReq.on('error', (e) => {
      log('server.clientReq.error', { msg: e.message });
      try {
        upstreamReq.destroy(e);
      } catch {
        /* */
      }
    });

    clientReq.pipe(upstreamReq);
  });
};

// Secondary stats hook (no-op, kept for diagnostics).
module.exports.statsServer = function (server) {
  log('statsServer.attach', {});
  server.on('request', (req, res) => {
    res.writeHead(200);
    res.end();
    log('statsServer.hit', { url: req.url, hook: req.headers[HOOK_HEADER] });
  });
};

module.exports.uiServer = function (server) {
  server.on('request', (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>llmscope</title>
<body style="font-family:system-ui;padding:2rem;color:#222;line-height:1.5">
  <h2 style="margin-top:0">llmscope plugin loaded</h2>
  <p>Active rules should look like:</p>
  <pre style="background:#f5f5f5;padding:1rem">api.openai.com llmscope://
api.anthropic.com llmscope://</pre>
  <p>Diagnostics: <code>tail -f ~/.llmscope/plugin.log</code></p>
  <p>Dashboard: <a href="http://127.0.0.1:47821/" target="_blank">http://127.0.0.1:47821/</a></p>
</body>`);
  });
};

// Test exports
module.exports._reconstructUrl = reconstructUrl;
module.exports._outboundHeaders = outboundHeaders;
