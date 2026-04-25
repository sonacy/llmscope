import pricingData from './pricing.json' with { type: 'json' };

export interface ModelPrice {
  prompt: number;
  completion: number;
}

const MODELS: Record<string, ModelPrice> = pricingData.models;

export function lookupPrice(model: string): ModelPrice | null {
  if (MODELS[model]) return MODELS[model];
  const normalized = model.toLowerCase().replace(/[_]/g, '-');
  if (MODELS[normalized]) return MODELS[normalized];
  for (const key of Object.keys(MODELS)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) return MODELS[key]!;
  }
  return null;
}

export function costUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const p = lookupPrice(model);
  if (!p) return null;
  return (promptTokens * p.prompt + completionTokens * p.completion) / 1_000_000;
}

export function knownModels(): readonly string[] {
  return Object.keys(MODELS);
}
