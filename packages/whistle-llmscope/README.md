# whistle.llmscope

Whistle plugin that captures LLM-shaped HTTP/SSE/WS traffic and forwards
events to the llmscope daemon at `http://127.0.0.1:<port>/api/ingest`.

## Capability matrix

| Transport | Supported |
|---|---|
| HTTP (request/response JSON) | yes |
| SSE (`text/event-stream`) | yes (OpenAI / Anthropic / Google reassembly) |
| WebSocket (Realtime APIs) | best-effort — see below |

### WebSocket caveat

Whistle's plugin API for raw WebSocket frames varies by version. The plugin
performs a runtime probe at load. If frame-level access is unavailable,
**WS capture is silently skipped** with a one-line warning to the daemon log
(via the next ingest event's metadata) and the user is recommended to use
the mitmproxy addon for OpenAI Realtime API debugging.

## Install

```sh
llmscope install whistle
cd ~/.llmscope/whistle.llmscope
w2 add .
# enable the "llmscope" plugin in the active rule from the whistle UI
llmscope start    # ensure the daemon is running
```

## Limitations

- Decompression: gzip, brotli, deflate supported via stdlib `zlib`. zstd
  requires Node 22+ (uses `zlib.zstdDecompressSync` when available).
- Body cap: 5 MB; oversize bodies are truncated with a marker.
- Header masking: `authorization`, `x-api-key`, `cookie`, etc., are
  replaced with `***MASKED***` before forwarding to the daemon.
- The plugin posts captured events out-of-band to the daemon. If the daemon
  is down, events are dropped (in-memory ring buffer planned for v2).
