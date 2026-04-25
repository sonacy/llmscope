import { describe, it, expect } from 'bun:test';
import { capBody, DEFAULT_BODY_CAP_BYTES, TRUNCATION_MARKER } from '../src/bodycap.ts';

describe('capBody', () => {
  it('passes small bodies through unchanged', () => {
    const r = capBody('hello');
    expect(r.body).toBe('hello');
    expect(r.truncated).toBe(false);
  });

  it('truncates oversize bodies and appends marker', () => {
    const big = 'x'.repeat(DEFAULT_BODY_CAP_BYTES + 100);
    const r = capBody(big);
    expect(r.truncated).toBe(true);
    expect(r.body!.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(Buffer.byteLength(r.body!, 'utf8')).toBeLessThanOrEqual(DEFAULT_BODY_CAP_BYTES);
  });

  it('handles null', () => {
    const r = capBody(null);
    expect(r.body).toBeNull();
    expect(r.truncated).toBe(false);
  });

  it('respects custom cap', () => {
    const r = capBody('abcdef', 4);
    expect(r.truncated).toBe(true);
  });
});
