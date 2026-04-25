# Known limitations (v1)

| Area | Limitation | Workaround |
|---|---|---|
| WS on whistle | Whistle's plugin API for raw WS frames varies by version. v1 ships a probe + skip; if probe fails, WS capture silently no-ops. | Use mitmproxy for OpenAI Realtime API debugging. |
| Bedrock streaming | The provider registry detects Bedrock by URL, but SSE reassembly only ports OpenAI/Anthropic/Google deltas. | Bedrock streamed responses store as raw bytes; the dashboard renders the unparsed stream. |
| Body cap | 5 MB hard cap with truncation marker. | Bump `LLMSCOPE_BODY_CAP` env var if you really need bigger; expect DB growth. |
| HTTP/2 | mitmproxy supports HTTP/2; whistle's HTTP/2 support depends on the user's proxy config. v1 fixture path is HTTP/1.1 only. | Real-world Anthropic/OpenAI APIs are HTTP/2-capable; the addons handle them transparently when the proxy negotiates. |
| zstd | Only available on Node 22+ (uses `zlib.zstdDecompressSync`). | Older Node falls back to identity-passthrough; very few LLM APIs use zstd today. |
| Editable replay | v1 is read-only re-send. | v2 will allow editing model/temp/messages and re-submitting. |
| Auto-restart | The daemon does not relaunch after crash. | Use `pm2`, `launchd`, or a shell loop if you need auto-restart. |
| Cross-platform | macOS + Linux are first-class. Windows PID semantics work but are best-effort. | Use WSL on Windows for the smoothest experience. |
