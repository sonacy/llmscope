'use strict';

// In-process SSE accumulator. Buffers raw chunks per-request and, on response
// end, parses SSE frames + reassembles per-provider deltas. Mirrors the logic
// in @llmscope/core/sse.ts so the JS plugin runs on plain Node without a TS
// transpile step.

function parseFrames(raw) {
  const frames = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event;
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) frames.push({ event, data: dataLines.join('\n') });
  }
  return frames;
}

function reassembleOpenAi(frames) {
  let text = '';
  let usage;
  let finishReason;
  for (const f of frames) {
    if (f.data === '[DONE]') continue;
    let json;
    try { json = JSON.parse(f.data); } catch { continue; }
    const choice = json && json.choices && json.choices[0];
    const delta = (choice && choice.delta) || {};
    if (typeof delta.content === 'string') text += delta.content;
    if (choice && choice.finish_reason) finishReason = choice.finish_reason;
    if (json && json.usage) {
      usage = {
        prompt_tokens: json.usage.prompt_tokens,
        completion_tokens: json.usage.completion_tokens,
        total_tokens: json.usage.total_tokens,
      };
    }
  }
  return { text, usage, finishReason, chunks: frames.length };
}

function reassembleAnthropic(frames) {
  let text = '';
  let usage;
  let finishReason;
  for (const f of frames) {
    let json;
    try { json = JSON.parse(f.data); } catch { continue; }
    const isContentDelta = f.event === 'content_block_delta' || (json && json.type === 'content_block_delta');
    if (isContentDelta && json && json.delta && json.delta.text) text += json.delta.text;
    const isMessageDelta = f.event === 'message_delta' || (json && json.type === 'message_delta');
    if (isMessageDelta && json) {
      if (json.delta && json.delta.stop_reason) finishReason = json.delta.stop_reason;
      if (json.usage) {
        usage = Object.assign({}, usage, {
          completion_tokens: json.usage.output_tokens != null ? json.usage.output_tokens : (usage && usage.completion_tokens),
        });
      }
    }
    const isMessageStart = f.event === 'message_start' || (json && json.type === 'message_start');
    if (isMessageStart && json && json.message && json.message.usage) {
      usage = {
        prompt_tokens: json.message.usage.input_tokens,
        completion_tokens: json.message.usage.output_tokens || 0,
        total_tokens: undefined,
      };
    }
  }
  if (usage && usage.prompt_tokens != null && usage.completion_tokens != null && usage.total_tokens == null) {
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
  }
  return { text, usage, finishReason, chunks: frames.length };
}

function reassembleGoogle(frames) {
  let text = '';
  let usage;
  let finishReason;
  for (const f of frames) {
    let json;
    try { json = JSON.parse(f.data); } catch { continue; }
    const cand = json && json.candidates && json.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    if (Array.isArray(parts)) for (const p of parts) if (typeof (p && p.text) === 'string') text += p.text;
    if (cand && cand.finishReason) finishReason = cand.finishReason;
    if (json && json.usageMetadata) {
      usage = {
        prompt_tokens: json.usageMetadata.promptTokenCount,
        completion_tokens: json.usageMetadata.candidatesTokenCount,
        total_tokens: json.usageMetadata.totalTokenCount,
      };
    }
  }
  return { text, usage, finishReason, chunks: frames.length };
}

function reassembleSse(raw, provider) {
  const frames = parseFrames(raw);
  if (provider === 'anthropic') return reassembleAnthropic(frames);
  if (provider === 'google') return reassembleGoogle(frames);
  return reassembleOpenAi(frames);
}

function detectProviderFromHost(host) {
  if (!host) return 'unknown';
  if (/api\.openai\.com$/i.test(host) || /oai\.azure\.com$/i.test(host)) return 'openai';
  if (/api\.anthropic\.com$/i.test(host)) return 'anthropic';
  if (/generativelanguage\.googleapis\.com$/i.test(host)) return 'google';
  return 'unknown';
}

module.exports = { parseFrames, reassembleSse, detectProviderFromHost };
