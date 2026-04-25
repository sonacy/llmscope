import { describe, it, expect } from 'bun:test';
import { maskHeaders, maskSecretsInText, MASK_TOKEN } from '../src/mask.ts';

describe('maskHeaders', () => {
  it('masks Authorization regardless of case', () => {
    const out = maskHeaders({ Authorization: 'Bearer sk-abc', 'x-api-key': 'k1', 'content-type': 'application/json' });
    expect(out['Authorization']).toBe(MASK_TOKEN);
    expect(out['x-api-key']).toBe(MASK_TOKEN);
    expect(out['content-type']).toBe('application/json');
  });

  it('respects an extra-names allowlist', () => {
    const out = maskHeaders({ 'x-custom-secret': 's' }, ['x-custom-secret']);
    expect(out['x-custom-secret']).toBe(MASK_TOKEN);
  });
});

describe('maskSecretsInText', () => {
  it('masks Bearer tokens', () => {
    expect(maskSecretsInText('Authorization: Bearer abcdefghij')).toContain(MASK_TOKEN);
  });

  it('masks sk- and sk-ant- and AIza keys', () => {
    expect(maskSecretsInText('use sk-1234567890abcdefXYZ')).toContain(MASK_TOKEN);
    expect(maskSecretsInText('key=sk-ant-abcdefghij1234567890')).toContain(MASK_TOKEN);
    expect(maskSecretsInText('AIzaSyABCDEFGHIJKLMNOPQRSTUVWX')).toContain(MASK_TOKEN);
  });
});
