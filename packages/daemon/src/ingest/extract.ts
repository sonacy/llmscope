import type { Usage } from '@llmscope/core';

export function extractModel(body: string | null): string | null {
  if (!body) return null;
  try {
    const o = JSON.parse(body);
    if (typeof o?.model === 'string') return o.model;
  } catch {
    /* */
  }
  return null;
}

export function extractUsageFromResponse(body: string | null): Usage {
  if (!body) return {};
  try {
    const o = JSON.parse(body);
    if (o?.usage) {
      return {
        prompt_tokens: o.usage.prompt_tokens ?? o.usage.input_tokens,
        completion_tokens: o.usage.completion_tokens ?? o.usage.output_tokens,
        total_tokens: o.usage.total_tokens,
      };
    }
    if (o?.usageMetadata) {
      return {
        prompt_tokens: o.usageMetadata.promptTokenCount,
        completion_tokens: o.usageMetadata.candidatesTokenCount,
        total_tokens: o.usageMetadata.totalTokenCount,
      };
    }
  } catch {
    /* */
  }
  return {};
}
