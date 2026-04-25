export const DEFAULT_BODY_CAP_BYTES = 5 * 1024 * 1024;
export const TRUNCATION_MARKER = '\n\n…[llmscope: body truncated]';

export interface CapResult {
  body: string | null;
  truncated: boolean;
}

export function capBody(body: string | null, capBytes = DEFAULT_BODY_CAP_BYTES): CapResult {
  if (body == null) return { body: null, truncated: false };
  const buf = Buffer.from(body, 'utf8');
  if (buf.byteLength <= capBytes) return { body, truncated: false };
  const sliceBytes = Math.max(0, capBytes - Buffer.byteLength(TRUNCATION_MARKER, 'utf8'));
  const sliced = buf.subarray(0, sliceBytes).toString('utf8');
  return { body: sliced + TRUNCATION_MARKER, truncated: true };
}
