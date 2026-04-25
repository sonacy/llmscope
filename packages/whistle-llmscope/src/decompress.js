'use strict';

const zlib = require('node:zlib');

function decode(buf, encoding) {
  if (!buf || buf.length === 0) return Buffer.alloc(0);
  const enc = (encoding || '').toLowerCase().trim();
  if (!enc || enc === 'identity') return buf;
  if (enc === 'gzip') return zlib.gunzipSync(buf);
  if (enc === 'br') return zlib.brotliDecompressSync(buf);
  if (enc === 'deflate') {
    try {
      return zlib.inflateSync(buf);
    } catch {
      return zlib.inflateRawSync(buf);
    }
  }
  // zstd: Node 22+ exposes zlib.zstdDecompressSync; older Node would need fzstd.
  // We feature-detect rather than hard-fail.
  if (enc === 'zstd') {
    if (typeof zlib.zstdDecompressSync === 'function') return zlib.zstdDecompressSync(buf);
    throw new Error('llmscope: zstd decompression unavailable on this Node version');
  }
  return buf;
}

module.exports = { decode };
