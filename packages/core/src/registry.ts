import type { Provider } from './event.ts';

export interface ProviderRule {
  provider: Provider;
  hosts: readonly RegExp[];
  pathHints?: readonly RegExp[];
}

export const PROVIDER_RULES: readonly ProviderRule[] = [
  {
    provider: 'openai',
    hosts: [/(^|\.)openai\.com$/i, /(^|\.)api\.openai\.com$/i, /(^|\.)oai\.azure\.com$/i],
    pathHints: [/\/v1\/(chat|completions|responses|realtime)/i],
  },
  {
    provider: 'anthropic',
    hosts: [/(^|\.)anthropic\.com$/i, /(^|\.)api\.anthropic\.com$/i],
    pathHints: [/\/v1\/messages/i],
  },
  {
    provider: 'google',
    hosts: [/(^|\.)googleapis\.com$/i, /(^|\.)generativelanguage\.googleapis\.com$/i, /(^|\.)aiplatform\.googleapis\.com$/i],
    pathHints: [/\/v1(beta)?\/models\/[^/]+:(generate|streamGenerate)Content/i],
  },
  {
    provider: 'bedrock',
    hosts: [/(^|\.)bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com$/i],
    pathHints: [/\/model\/[^/]+\/(invoke|converse)(-with-response-stream)?/i],
  },
  { provider: 'cohere', hosts: [/(^|\.)api\.cohere\.(com|ai)$/i] },
  { provider: 'mistral', hosts: [/(^|\.)api\.mistral\.ai$/i] },
  { provider: 'together', hosts: [/(^|\.)api\.together\.(xyz|ai)$/i] },
  { provider: 'groq', hosts: [/(^|\.)api\.groq\.com$/i] },
  { provider: 'openrouter', hosts: [/(^|\.)openrouter\.ai$/i] },
];

export function detectProvider(url: string): Provider {
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return 'unknown';
  }
  for (const rule of PROVIDER_RULES) {
    const hostMatch = rule.hosts.some((re) => re.test(host));
    if (!hostMatch) continue;
    if (rule.pathHints && !rule.pathHints.some((re) => re.test(path))) continue;
    return rule.provider;
  }
  return 'unknown';
}

export function looksLikeLlmBody(rawBody: string | null | undefined): boolean {
  if (!rawBody) return false;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return false;
  }
  if (!json || typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  const hasModel = typeof o['model'] === 'string';
  const hasMessages = Array.isArray(o['messages']);
  const hasPrompt = typeof o['prompt'] === 'string';
  const hasContents = Array.isArray(o['contents']);
  return hasModel && (hasMessages || hasPrompt || hasContents);
}
