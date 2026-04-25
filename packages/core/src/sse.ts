import type { Provider, Usage } from './event.ts';

export interface ReassembleResult {
  text: string;
  usage?: Usage;
  finishReason?: string;
  toolCalls?: unknown[];
  chunks: number;
}

interface SseFrame {
  event?: string;
  data: string;
}

function parseFrames(raw: string): SseFrame[] {
  const out: SseFrame[] = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) continue;
    out.push({ event, data: dataLines.join('\n') });
  }
  return out;
}

function reassembleOpenAi(frames: SseFrame[]): ReassembleResult {
  let text = '';
  let usage: Usage | undefined;
  let finishReason: string | undefined;
  const toolCalls: Record<number, { id?: string; name?: string; args: string }> = {};
  for (const f of frames) {
    if (f.data === '[DONE]') continue;
    let json: any;
    try {
      json = JSON.parse(f.data);
    } catch {
      continue;
    }
    const choice = json?.choices?.[0];
    const delta = choice?.delta ?? {};
    if (typeof delta.content === 'string') text += delta.content;
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCalls[idx]) toolCalls[idx] = { args: '' };
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function?.name) toolCalls[idx].name = tc.function.name;
        if (typeof tc.function?.arguments === 'string') toolCalls[idx].args += tc.function.arguments;
      }
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (json?.usage) {
      usage = {
        prompt_tokens: json.usage.prompt_tokens,
        completion_tokens: json.usage.completion_tokens,
        total_tokens: json.usage.total_tokens,
      };
    }
  }
  const tools = Object.values(toolCalls);
  return {
    text,
    usage,
    finishReason,
    toolCalls: tools.length > 0 ? tools : undefined,
    chunks: frames.length,
  };
}

function reassembleAnthropic(frames: SseFrame[]): ReassembleResult {
  let text = '';
  let usage: Usage | undefined;
  let finishReason: string | undefined;
  for (const f of frames) {
    let json: any;
    try {
      json = JSON.parse(f.data);
    } catch {
      continue;
    }
    if (f.event === 'content_block_delta' || json.type === 'content_block_delta') {
      if (json.delta?.text) text += json.delta.text;
    }
    if (f.event === 'message_delta' || json.type === 'message_delta') {
      if (json.delta?.stop_reason) finishReason = json.delta.stop_reason;
      if (json.usage) {
        usage = {
          ...(usage ?? {}),
          completion_tokens: json.usage.output_tokens ?? usage?.completion_tokens,
        };
      }
    }
    if (f.event === 'message_start' || json.type === 'message_start') {
      if (json.message?.usage) {
        usage = {
          prompt_tokens: json.message.usage.input_tokens,
          completion_tokens: json.message.usage.output_tokens ?? 0,
          total_tokens: undefined,
        };
      }
    }
  }
  if (usage && usage.prompt_tokens !== undefined && usage.completion_tokens !== undefined && usage.total_tokens === undefined) {
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
  }
  return { text, usage, finishReason, chunks: frames.length };
}

function reassembleGoogle(frames: SseFrame[]): ReassembleResult {
  let text = '';
  let usage: Usage | undefined;
  let finishReason: string | undefined;
  for (const f of frames) {
    let json: any;
    try {
      json = JSON.parse(f.data);
    } catch {
      continue;
    }
    const cand = json?.candidates?.[0];
    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) if (typeof p?.text === 'string') text += p.text;
    }
    if (cand?.finishReason) finishReason = cand.finishReason;
    if (json?.usageMetadata) {
      usage = {
        prompt_tokens: json.usageMetadata.promptTokenCount,
        completion_tokens: json.usageMetadata.candidatesTokenCount,
        total_tokens: json.usageMetadata.totalTokenCount,
      };
    }
  }
  return { text, usage, finishReason, chunks: frames.length };
}

export function reassembleSse(raw: string, provider: Provider): ReassembleResult {
  const frames = parseFrames(raw);
  switch (provider) {
    case 'anthropic':
      return reassembleAnthropic(frames);
    case 'google':
      return reassembleGoogle(frames);
    default:
      return reassembleOpenAi(frames);
  }
}
