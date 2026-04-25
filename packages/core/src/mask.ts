import type { Headers } from './event';

export const DEFAULT_MASK_HEADERS = new Set([
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

export const MASK_TOKEN = '***MASKED***';

export function maskHeaders(headers: Headers, extraNames: Iterable<string> = []): Headers {
  const blocked = new Set<string>([...DEFAULT_MASK_HEADERS, ...Array.from(extraNames, (n) => n.toLowerCase())]);
  const out: Headers = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = blocked.has(k.toLowerCase()) ? MASK_TOKEN : v;
  }
  return out;
}

const BEARER_RE = /(Bearer\s+)([A-Za-z0-9._\-+=/]{8,})/gi;
const SK_RE = /\b(sk-(?:[A-Za-z0-9_-]{16,}|proj-[A-Za-z0-9_-]{16,}))\b/g;
const ANTHROPIC_RE = /\b(sk-ant-[A-Za-z0-9_-]{16,})\b/g;
const GOOGLE_RE = /\b(AIza[0-9A-Za-z_-]{20,})\b/g;

export function maskSecretsInText(s: string): string {
  return s
    .replace(BEARER_RE, (_m, prefix) => `${prefix}${MASK_TOKEN}`)
    .replace(SK_RE, MASK_TOKEN)
    .replace(ANTHROPIC_RE, MASK_TOKEN)
    .replace(GOOGLE_RE, MASK_TOKEN);
}
