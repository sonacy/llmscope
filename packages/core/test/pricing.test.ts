import { describe, it, expect } from 'bun:test';
import { lookupPrice, costUsd, knownModels } from '../src/pricing.ts';

describe('lookupPrice', () => {
  it('exact-matches a known model', () => {
    const p = lookupPrice('gpt-4o-mini');
    expect(p).not.toBeNull();
    expect(p!.prompt).toBeGreaterThan(0);
    expect(p!.completion).toBeGreaterThan(p!.prompt);
  });

  it('falls back to prefix match for date-suffixed model ids', () => {
    expect(lookupPrice('claude-3-5-sonnet-20240620')).not.toBeNull();
  });

  it('returns null for unknown', () => {
    expect(lookupPrice('totally-fake-model-9001')).toBeNull();
  });
});

describe('costUsd', () => {
  it('computes cost for known model', () => {
    // gpt-4o: 2.5 prompt, 10 completion per 1M
    const c = costUsd('gpt-4o', 1_000_000, 1_000_000);
    expect(c).toBeCloseTo(12.5, 5);
  });

  it('returns null for unknown', () => {
    expect(costUsd('nope-fake', 100, 100)).toBeNull();
  });
});

describe('knownModels', () => {
  it('lists all models', () => {
    expect(knownModels().length).toBeGreaterThan(20);
  });
});
