import type { Source, Headers } from './event';

export type MatchType = 'ua_exact' | 'ua_prefix' | 'ua_regex' | 'host' | 'shape';

export interface Fingerprint {
  match_type: MatchType;
  pattern: string;
  kind: string;
  label: string;
  confidence: number;
  user_defined?: boolean;
}

export const BUILTIN_FINGERPRINTS: readonly Fingerprint[] = [
  { match_type: 'ua_prefix', pattern: 'claude-cli/', kind: 'claude-code', label: 'Claude Code', confidence: 0.98 },
  { match_type: 'ua_regex', pattern: '^Cursor/', kind: 'cursor', label: 'Cursor', confidence: 0.97 },
  { match_type: 'host', pattern: 'api2.cursor.sh', kind: 'cursor', label: 'Cursor', confidence: 0.97 },
  { match_type: 'ua_prefix', pattern: 'OpenAI/Codex-CLI', kind: 'codex', label: 'Codex CLI', confidence: 0.98 },
  { match_type: 'ua_prefix', pattern: 'aider/', kind: 'aider', label: 'Aider', confidence: 0.95 },
  { match_type: 'ua_prefix', pattern: 'continue/', kind: 'continue', label: 'Continue.dev', confidence: 0.9 },
  { match_type: 'host', pattern: 'chat.openai.com', kind: 'browser-chatgpt', label: 'ChatGPT (web)', confidence: 0.85 },
  { match_type: 'host', pattern: 'chatgpt.com', kind: 'browser-chatgpt', label: 'ChatGPT (web)', confidence: 0.85 },
  { match_type: 'host', pattern: 'claude.ai', kind: 'browser-claude', label: 'Claude (web)', confidence: 0.85 },
  { match_type: 'host', pattern: 'gemini.google.com', kind: 'browser-gemini', label: 'Gemini (web)', confidence: 0.85 },
  { match_type: 'ua_regex', pattern: '(?i)mozilla|chrome|safari|firefox', kind: 'browser', label: 'Browser', confidence: 0.5 },
];

export interface AttributeInput {
  ua: string;
  host: string;
  body?: string | null;
}

function matches(fp: Fingerprint, input: AttributeInput): boolean {
  switch (fp.match_type) {
    case 'ua_exact':
      return input.ua === fp.pattern;
    case 'ua_prefix':
      return input.ua.startsWith(fp.pattern);
    case 'ua_regex':
      try {
        // Allow (?i) prefix as a portable case-insensitive flag (whistle plugin uses Node, addon.py uses Python re).
        let flags = '';
        let pattern = fp.pattern;
        if (pattern.startsWith('(?i)')) {
          flags = 'i';
          pattern = pattern.slice(4);
        }
        return new RegExp(pattern, flags).test(input.ua);
      } catch {
        return false;
      }
    case 'host':
      return input.host.toLowerCase() === fp.pattern.toLowerCase();
    case 'shape':
      return !!input.body && input.body.includes(fp.pattern);
  }
}

export function attribute(input: AttributeInput, fingerprints: readonly Fingerprint[] = BUILTIN_FINGERPRINTS): Source {
  // Order: user-defined first, then built-in. Within each group, first match wins.
  const userFps = fingerprints.filter((f) => f.user_defined);
  const builtinFps = fingerprints.filter((f) => !f.user_defined);
  for (const fp of [...userFps, ...builtinFps]) {
    if (matches(fp, input)) {
      return { kind: fp.kind, label: fp.label, confidence: fp.confidence };
    }
  }
  return { kind: 'unknown', label: input.ua || 'unknown', confidence: 0 };
}

export function uaFromHeaders(headers: Headers): string {
  return headers['user-agent'] ?? headers['User-Agent'] ?? '';
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
