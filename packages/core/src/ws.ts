import type { Provider, Usage } from './event';

export interface WsFrame {
  direction: 'client' | 'server';
  ts: number;
  text: string;
}

export interface WsReassembleResult {
  transcript: string;
  usage?: Usage;
  frames: number;
  events: { type: string; count: number }[];
}

export function reassembleWs(frames: readonly WsFrame[], provider: Provider): WsReassembleResult {
  if (provider !== 'openai') {
    return {
      transcript: frames.map((f) => `[${f.direction}] ${f.text}`).join('\n'),
      frames: frames.length,
      events: [],
    };
  }
  let transcript = '';
  let usage: Usage | undefined;
  const counts = new Map<string, number>();
  for (const f of frames) {
    let json: any;
    try {
      json = JSON.parse(f.text);
    } catch {
      continue;
    }
    const t: string = json?.type ?? 'unknown';
    counts.set(t, (counts.get(t) ?? 0) + 1);
    if (t === 'response.audio_transcript.delta' && typeof json.delta === 'string') {
      transcript += json.delta;
    } else if (t === 'response.text.delta' && typeof json.delta === 'string') {
      transcript += json.delta;
    } else if (t === 'response.done' && json.response?.usage) {
      const u = json.response.usage;
      usage = {
        prompt_tokens: u.input_tokens,
        completion_tokens: u.output_tokens,
        total_tokens: u.total_tokens,
      };
    }
  }
  return {
    transcript,
    usage,
    frames: frames.length,
    events: Array.from(counts, ([type, count]) => ({ type, count })),
  };
}
