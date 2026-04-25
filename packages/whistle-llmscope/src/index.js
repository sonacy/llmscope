'use strict';

// whistle.llmscope — captures LLM-shaped HTTP traffic and forwards events to
// the llmscope daemon at http://127.0.0.1:<port>/api/ingest.
//
// Whistle invokes plugins via *named* exports (NOT a single default function).
// Reference: https://github.com/avwo/whistle/wiki/插件开发
//
// We use:
//   - statsServer  — fires for every completed request; whistle pipes a JSON
//                    line per request into this TCP server.
//   - reqRead      — per-request request-body stream (correlated by id).
//   - resRead      — per-request response-body stream (correlated by id).
//   - uiServer     — tiny "is the plugin alive?" page in the whistle plugins UI.

const { shouldCapture, buildEvent } = require('./capture');
const { postEvent } = require('./post');

const DEBUG = process.env.LLMSCOPE_DEBUG === '1';
function debug(...args) {
  if (DEBUG) console.error('[llmscope]', ...args);
}

function tryParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// Per-request body buffers, keyed by whistle's request id. Filled by
// reqRead / resRead, drained by statsServer when the request completes.
const reqBodies = new Map();
const resBodies = new Map();
const MAX_BUFFER_BYTES = 5 * 1024 * 1024;

function appendBody(map, id, chunk) {
  if (!id) return;
  const prev = map.get(id) || '';
  if (prev.length + chunk.length > MAX_BUFFER_BYTES) return;
  map.set(id, prev + chunk);
}

function lineReader(socket, onLine) {
  let buf = '';
  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onLine(line);
    }
  });
  socket.on('error', (e) => debug('socket error', e.message));
}

// statsServer: TCP server. Whistle opens connections and streams JSON lines,
// one per completed request. Observed fields (whistle ≥ 2):
//   { id, url, realUrl, method, statusCode, reqHeaders, resHeaders,
//     startTime, endTime, ... }
// Bodies are *not* in this frame in older whistle builds — they come via
// reqRead / resRead correlated by id. Newer builds include req.body / res.body
// directly; we accept either shape.
module.exports.statsServer = function (server) {
  server.on('connection', (socket) => {
    debug('statsServer connection');
    lineReader(socket, handleStatFrame);
    socket.on('close', () => debug('statsServer connection closed'));
  });
  server.on('error', (e) => debug('statsServer error', e.message));
  debug('statsServer ready');
};

// reqRead: TCP server. Whistle opens one connection per request and streams
// the request body. The first line of the connection is the request id.
module.exports.reqRead = function (server) {
  server.on('connection', (socket) => {
    handleBodyConnection(socket, reqBodies);
  });
};

// resRead: same shape for response bodies.
module.exports.resRead = function (server) {
  server.on('connection', (socket) => {
    handleBodyConnection(socket, resBodies);
  });
};

function handleBodyConnection(socket, target) {
  let id = '';
  let headerSeen = false;
  socket.on('data', (chunk) => {
    let s = chunk.toString('utf8');
    if (!headerSeen) {
      const nl = s.indexOf('\n');
      if (nl < 0) {
        id += s;
        return;
      }
      id = (id + s.slice(0, nl)).trim();
      headerSeen = true;
      s = s.slice(nl + 1);
    }
    if (s.length) appendBody(target, id, s);
  });
  socket.on('end', () => debug('body stream end', id, '(', (target.get(id) || '').length, 'bytes)'));
  socket.on('error', (e) => debug('body socket error', e.message));
}

// uiServer: visible at the plugin's UI tab inside whistle's web UI.
module.exports.uiServer = function (server) {
  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>llmscope</title>
<body style="font-family:system-ui;padding:2rem;color:#222;line-height:1.5">
  <h2 style="margin-top:0">llmscope plugin loaded</h2>
  <p>Captured events are forwarded to <code>http://127.0.0.1:47821/api/ingest</code>.</p>
  <p>Open the dashboard at <a href="http://127.0.0.1:47821/" target="_blank">http://127.0.0.1:47821/</a>.</p>
  <p>Set <code>LLMSCOPE_DEBUG=1</code> in whistle's env to log frame parsing to stderr.</p>
</body>`,
    );
  });
};

function handleStatFrame(line) {
  const data = tryParse(line);
  if (!data) {
    debug('non-JSON frame', line.slice(0, 80));
    return;
  }
  const url = data.url || data.realUrl || data.fullUrl;
  if (!url) return;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }

  const id = data.id || data.reqId;
  const requestBody =
    (data.req && (data.req.body || data.req.text)) ||
    data.reqBody ||
    (id ? reqBodies.get(id) : null) ||
    null;
  const responseBody =
    (data.res && (data.res.body || data.res.text)) ||
    data.resBody ||
    (id ? resBodies.get(id) : null) ||
    null;

  // Free the per-request buffers regardless of capture decision.
  if (id) {
    reqBodies.delete(id);
    resBodies.delete(id);
  }

  if (!shouldCapture({ host, requestBody })) {
    debug('skip', host);
    return;
  }

  const event = buildEvent({
    tsStart: data.startTime || data.requestTime || Date.now(),
    tsEnd: data.endTime || data.responseTime || Date.now(),
    method: data.method || 'GET',
    url,
    requestHeaders: data.reqHeaders || data.headers || {},
    requestBody,
    status: data.statusCode || data.status || null,
    responseHeaders: data.resHeaders || {},
    responseBody,
  });

  postEvent(event, (err, status) => {
    if (err) debug('ingest err', err.message);
    else debug('ingest', status, event.url);
  });
}

// Re-exported for in-process tests.
module.exports._handleStatFrame = handleStatFrame;
module.exports._capture = require('./capture');
module.exports._post = require('./post');
