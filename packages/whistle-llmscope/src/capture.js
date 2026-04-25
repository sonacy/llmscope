'use strict';

const KNOWN_HOSTS = [
  /(^|\.)api\.openai\.com$/i,
  /(^|\.)oai\.azure\.com$/i,
  /(^|\.)api\.anthropic\.com$/i,
  /(^|\.)generativelanguage\.googleapis\.com$/i,
  /(^|\.)bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com$/i,
  /(^|\.)api\.cohere\.(com|ai)$/i,
  /(^|\.)api\.mistral\.ai$/i,
  /(^|\.)api\.together\.(xyz|ai)$/i,
  /(^|\.)api\.groq\.com$/i,
  /(^|\.)openrouter\.ai$/i,
  /(^|\.)api2\.cursor\.sh$/i,
];

const MASK_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'x-goog-api-key',
  'anthropic-api-key',
  'openai-api-key',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);
const MASK_TOKEN = '***MASKED***';

function maskHeaders(h) {
  const out = {};
  for (const k of Object.keys(h || {})) {
    out[k] = MASK_HEADERS.has(k.toLowerCase()) ? MASK_TOKEN : h[k];
  }
  return out;
}

function looksLikeLlmHost(host) {
  if (!host) return false;
  return KNOWN_HOSTS.some((re) => re.test(host));
}

function looksLikeLlmBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') return false;
  let json;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return false;
  }
  if (!json || typeof json !== 'object') return false;
  const hasModel = typeof json.model === 'string';
  const hasMessages = Array.isArray(json.messages);
  const hasPrompt = typeof json.prompt === 'string';
  const hasContents = Array.isArray(json.contents);
  return hasModel && (hasMessages || hasPrompt || hasContents);
}

function shouldCapture({ host, requestBody }) {
  return looksLikeLlmHost(host) || looksLikeLlmBody(requestBody);
}

function buildEvent({ tsStart, tsEnd, method, url, requestHeaders, requestBody, status, responseHeaders, responseBody }) {
  return {
    ts_start: tsStart,
    ts_end: tsEnd,
    transport: 'http',
    method: method || 'GET',
    url,
    request_headers: maskHeaders(requestHeaders),
    request_body: requestBody == null ? null : String(requestBody),
    status: status == null ? null : Number(status),
    response_headers: maskHeaders(responseHeaders),
    response_body: responseBody == null ? null : String(responseBody),
  };
}

module.exports = { shouldCapture, buildEvent, looksLikeLlmHost, looksLikeLlmBody, maskHeaders, MASK_TOKEN };
