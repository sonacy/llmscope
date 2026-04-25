# Security

llmscope is a single-user, local-only tool. The threat model is "another local user/process on the same machine," not "remote internet."

## What's protected

- **Network exposure.** Daemon binds `127.0.0.1` only. There is no `0.0.0.0` mode in v1.
- **Bearer auth.** All `/api/*` calls (except `/api/health` and `/api/_bootstrap`) require `Authorization: Bearer <token>`. The token lives at `~/.llmscope/token`, mode `0600`. Generated on first daemon start; rotate with `llmscope rotate-token`.
- **CORS.** Cross-origin browser requests are denied at preflight unless origin host is `127.0.0.1` or `localhost`. The dashboard is the only legit consumer.
- **Header masking.** `Authorization`, `x-api-key`, `cookie`, `set-cookie`, and provider-specific keys are replaced with `***MASKED***` before the row hits SQLite. Replay therefore returns 409 if the original request can't be re-authed — this is intentional.
- **Body cap.** Request and response bodies are capped at 5 MB (configurable via `LLMSCOPE_BODY_CAP`). Truncation marker is appended; the UI shows a banner.
- **No outbound calls.** llmscope's own daemon never connects out. The only egress paths are (a) the user-initiated **replay** button, which re-sends a captured request to the original target host, and (b) addons POSTing into the daemon over loopback.

## What's NOT protected

- The SQLite file at `~/.llmscope/db.sqlite` is plaintext and readable by any process running as the same OS user. Do not run llmscope on a shared machine.
- The `token` file is plaintext at `~/.llmscope/token` (mode 0600). Same caveat — your OS file permissions are the boundary.
- `llmscope export --format jsonl` falls back to a direct DB read if the daemon is down. There is no auth on this fallback path; the OS file permission on `db.sqlite` is the security boundary.
- Captured request bodies may contain sensitive content (prompts, customer data, RAG context). Treat the DB like a debug log.
- Replay sends the exact captured request back to the target. If you replay something you shouldn't (e.g., a destructive POST), llmscope will not stop you.

## Reporting a vulnerability

Open a private security advisory on GitHub or email the maintainer.
