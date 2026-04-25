'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

function homeDir() {
  return process.env.LLMSCOPE_HOME || path.join(os.homedir(), '.llmscope');
}

function readToken() {
  if (process.env.LLMSCOPE_TOKEN) return process.env.LLMSCOPE_TOKEN.trim();
  try {
    return fs.readFileSync(path.join(homeDir(), 'token'), 'utf8').trim();
  } catch {
    return '';
  }
}

function daemonUrl() {
  const host = process.env.LLMSCOPE_HOST || '127.0.0.1';
  const port = process.env.LLMSCOPE_PORT || '47821';
  return `http://${host}:${port}`;
}

function postEvent(event, cb) {
  const url = new URL('/api/ingest', daemonUrl());
  const data = Buffer.from(JSON.stringify(event), 'utf8');
  const req = http.request(
    {
      method: 'POST',
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'content-type': 'application/json',
        'content-length': data.length,
        authorization: `Bearer ${readToken()}`,
      },
      timeout: 2000,
    },
    (res) => {
      res.resume();
      res.on('end', () => cb && cb(null, res.statusCode || 0));
    },
  );
  req.on('error', (e) => cb && cb(e));
  req.on('timeout', () => req.destroy(new Error('llmscope: ingest timeout')));
  req.end(data);
}

module.exports = { postEvent, readToken, daemonUrl };
