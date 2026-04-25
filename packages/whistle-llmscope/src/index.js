'use strict';

// whistle.llmscope — captures LLM-shaped HTTP traffic and forwards to the
// llmscope daemon at http://127.0.0.1:<port>/api/ingest. v1: HTTP only.
// SSE/WS reassembly land in steps 36/37.

const { shouldCapture, buildEvent } = require('./capture');
const { postEvent } = require('./post');

// Whistle invokes plugins via several entrypoints. The one that gives us
// access to full request and response bodies is `module.exports.statsServer`,
// which receives JSON frames over a unix socket whenever a request completes.
// Whistle marshals { req, res } summaries into that frame.
module.exports = function (server, options) {
  // The recommended whistle plugin form for stats access:
  // https://github.com/avwo/whistle/wiki/插件开发#statsserver
  // We accept both `req`/`res` shapes and translate to our event contract.
  server.on('request', (socket, head) => {
    socket.on('data', (chunk) => onFrame(chunk));
  });
};

function onFrame(buf) {
  let frame;
  try {
    frame = JSON.parse(buf.toString('utf8'));
  } catch {
    return;
  }
  const req = frame.req || {};
  const res = frame.res || {};
  const tsStart = req.requestTime || req.startTime || Date.now();
  const tsEnd = res.endTime || Date.now();
  const url = req.fullUrl || req.url;
  if (!url) return;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  const requestBody = typeof req.body === 'string' ? req.body : null;
  if (!shouldCapture({ host, requestBody })) return;

  const event = buildEvent({
    tsStart,
    tsEnd,
    method: req.method || 'GET',
    url,
    requestHeaders: req.headers || {},
    requestBody,
    status: res.statusCode,
    responseHeaders: res.headers || {},
    responseBody: typeof res.body === 'string' ? res.body : null,
  });

  postEvent(event, (err) => {
    if (err) {
      // Drop silently — daemon may be down. Future: ring buffer with retry.
    }
  });
}

// Exports for in-process testing / reuse from other proxies.
module.exports.onFrame = onFrame;
module.exports._capture = require('./capture');
module.exports._post = require('./post');
