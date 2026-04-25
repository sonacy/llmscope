#!/usr/bin/env python3
"""llmscope mitmproxy addon — captures LLM HTTP/SSE/WS traffic.

Run via:
    mitmdump -s ~/.llmscope/mitmproxy_addon.py

Configuration via env vars:
    LLMSCOPE_HOST  (default 127.0.0.1)
    LLMSCOPE_PORT  (default 47821)
    LLMSCOPE_TOKEN (preferred) — falls back to ~/.llmscope/token

Stdlib-only at runtime (mitmproxy provides the `mitmproxy.http`/`websocket`
APIs). No third-party Python deps so the addon stays a single self-contained
file the user can copy.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants mirrored from @llmscope/core. Keep in sync with src/event.ts,
# src/registry.ts, src/mask.ts, src/bodycap.ts.
# ---------------------------------------------------------------------------

KNOWN_HOSTS: list[re.Pattern[str]] = [
    re.compile(r"(^|\.)api\.openai\.com$", re.I),
    re.compile(r"(^|\.)oai\.azure\.com$", re.I),
    re.compile(r"(^|\.)api\.anthropic\.com$", re.I),
    re.compile(r"(^|\.)generativelanguage\.googleapis\.com$", re.I),
    re.compile(r"(^|\.)bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com$", re.I),
    re.compile(r"(^|\.)api\.cohere\.(com|ai)$", re.I),
    re.compile(r"(^|\.)api\.mistral\.ai$", re.I),
    re.compile(r"(^|\.)api\.together\.(xyz|ai)$", re.I),
    re.compile(r"(^|\.)api\.groq\.com$", re.I),
    re.compile(r"(^|\.)openrouter\.ai$", re.I),
    re.compile(r"(^|\.)api2\.cursor\.sh$", re.I),
]

MASK_HEADERS = {
    "authorization", "x-api-key", "api-key", "x-goog-api-key",
    "anthropic-api-key", "openai-api-key", "cookie", "set-cookie",
    "proxy-authorization",
}
MASK_TOKEN = "***MASKED***"
BODY_CAP_BYTES = 5 * 1024 * 1024
TRUNC_MARKER = "\n\n…[llmscope: body truncated]"

CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _ulid(ts_ms: int | None = None) -> str:
    """Pure Python ULID. Deterministic time prefix + 80 random bits."""
    ts = int(time.time() * 1000) if ts_ms is None else int(ts_ms)
    rand = int.from_bytes(secrets.token_bytes(10), "big")
    n = (ts << 80) | rand
    out = []
    for _ in range(26):
        out.append(CROCKFORD_ALPHABET[n & 0x1F])
        n >>= 5
    return "evt_" + "".join(reversed(out))


def _mask_headers(h: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in (h or {}).items():
        out[k] = MASK_TOKEN if k.lower() in MASK_HEADERS else v
    return out


def _cap_body(b: str | None) -> tuple[str | None, bool]:
    if b is None:
        return None, False
    raw = b.encode("utf-8")
    if len(raw) <= BODY_CAP_BYTES:
        return b, False
    marker = TRUNC_MARKER.encode("utf-8")
    sliced = raw[: max(0, BODY_CAP_BYTES - len(marker))].decode("utf-8", errors="ignore")
    return sliced + TRUNC_MARKER, True


def _looks_like_llm_host(host: str) -> bool:
    return any(p.search(host) for p in KNOWN_HOSTS)


def _looks_like_llm_body(body: str | None) -> bool:
    if not body:
        return False
    try:
        o = json.loads(body[:65536])
    except Exception:
        return False
    if not isinstance(o, dict):
        return False
    has_model = isinstance(o.get("model"), str)
    has_messages = isinstance(o.get("messages"), list)
    has_prompt = isinstance(o.get("prompt"), str)
    has_contents = isinstance(o.get("contents"), list)
    return has_model and (has_messages or has_prompt or has_contents)


def _detect_provider(host: str) -> str:
    h = host.lower()
    if h.endswith("api.openai.com") or h.endswith("oai.azure.com"):
        return "openai"
    if h.endswith("api.anthropic.com"):
        return "anthropic"
    if h.endswith("generativelanguage.googleapis.com"):
        return "google"
    if "bedrock-runtime" in h:
        return "bedrock"
    if h.endswith("api.cohere.com") or h.endswith("api.cohere.ai"):
        return "cohere"
    if h.endswith("api.mistral.ai"):
        return "mistral"
    if h.endswith("api.together.xyz") or h.endswith("api.together.ai"):
        return "together"
    if h.endswith("api.groq.com"):
        return "groq"
    if h.endswith("openrouter.ai"):
        return "openrouter"
    return "unknown"


# ---------------------------------------------------------------------------
# SSE reassembly. Mirrors @llmscope/core/sse.ts.
# ---------------------------------------------------------------------------

def _parse_sse(raw: str) -> list[dict[str, str]]:
    frames: list[dict[str, str]] = []
    for block in re.split(r"\r?\n\r?\n", raw):
        if not block.strip():
            continue
        event = None
        data_lines: list[str] = []
        for line in re.split(r"\r?\n", block):
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].strip())
        if data_lines:
            frames.append({"event": event or "", "data": "\n".join(data_lines)})
    return frames


def _reassemble_sse(raw: str, provider: str) -> dict[str, Any]:
    frames = _parse_sse(raw)
    text = ""
    usage: dict[str, Any] = {}
    finish_reason: str | None = None
    if provider == "anthropic":
        for f in frames:
            try:
                j = json.loads(f["data"])
            except Exception:
                continue
            evt = f.get("event") or j.get("type") or ""
            if evt == "content_block_delta":
                d = j.get("delta") or {}
                if d.get("text"):
                    text += d["text"]
            elif evt == "message_start":
                u = (j.get("message") or {}).get("usage") or {}
                if u:
                    usage = {
                        "prompt_tokens": u.get("input_tokens"),
                        "completion_tokens": u.get("output_tokens", 0),
                    }
            elif evt == "message_delta":
                if (j.get("delta") or {}).get("stop_reason"):
                    finish_reason = j["delta"]["stop_reason"]
                u = j.get("usage") or {}
                if u and "output_tokens" in u:
                    usage["completion_tokens"] = u["output_tokens"]
        if "prompt_tokens" in usage and "completion_tokens" in usage:
            usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
    elif provider == "google":
        for f in frames:
            try:
                j = json.loads(f["data"])
            except Exception:
                continue
            cand = (j.get("candidates") or [{}])[0]
            for p in (cand.get("content") or {}).get("parts") or []:
                if isinstance(p.get("text"), str):
                    text += p["text"]
            if cand.get("finishReason"):
                finish_reason = cand["finishReason"]
            um = j.get("usageMetadata") or {}
            if um:
                usage = {
                    "prompt_tokens": um.get("promptTokenCount"),
                    "completion_tokens": um.get("candidatesTokenCount"),
                    "total_tokens": um.get("totalTokenCount"),
                }
    else:  # openai-compatible default
        for f in frames:
            if f["data"] == "[DONE]":
                continue
            try:
                j = json.loads(f["data"])
            except Exception:
                continue
            choice = (j.get("choices") or [{}])[0]
            delta = choice.get("delta") or {}
            if isinstance(delta.get("content"), str):
                text += delta["content"]
            if choice.get("finish_reason"):
                finish_reason = choice["finish_reason"]
            u = j.get("usage")
            if u:
                usage = {
                    "prompt_tokens": u.get("prompt_tokens"),
                    "completion_tokens": u.get("completion_tokens"),
                    "total_tokens": u.get("total_tokens"),
                }
    return {"text": text, "usage": usage or None, "finish_reason": finish_reason, "chunks": len(frames)}


# ---------------------------------------------------------------------------
# Daemon ingest client with simple ring buffer (drop-oldest, no retry in v1).
# ---------------------------------------------------------------------------

class IngestClient:
    def __init__(self) -> None:
        host = os.environ.get("LLMSCOPE_HOST", "127.0.0.1")
        port = os.environ.get("LLMSCOPE_PORT", "47821")
        self._url = f"http://{host}:{port}/api/ingest"
        self._token = self._read_token()
        self._buffer: deque[dict[str, Any]] = deque(maxlen=1000)
        self._lock = threading.Lock()
        self._worker = threading.Thread(target=self._drain, daemon=True)
        self._worker.start()

    def _read_token(self) -> str:
        if os.environ.get("LLMSCOPE_TOKEN"):
            return os.environ["LLMSCOPE_TOKEN"].strip()
        try:
            return Path.home().joinpath(".llmscope/token").read_text().strip()
        except FileNotFoundError:
            return ""

    def submit(self, event: dict[str, Any]) -> None:
        with self._lock:
            self._buffer.append(event)

    def _drain(self) -> None:
        while True:
            try:
                event: dict[str, Any] | None
                with self._lock:
                    event = self._buffer.popleft() if self._buffer else None
                if event is None:
                    time.sleep(0.05)
                    continue
                self._post(event)
            except Exception as e:  # never let the worker die
                print(f"llmscope: ingest worker error: {e}", file=sys.stderr)

    def _post(self, event: dict[str, Any]) -> None:
        body = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            self._url, data=body, method="POST",
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {self._token}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=2) as _:
                pass
        except Exception as e:
            print(f"llmscope: ingest POST failed ({e}); event dropped", file=sys.stderr)


# ---------------------------------------------------------------------------
# mitmproxy addon class. mitmproxy auto-registers via the `addons` global.
# ---------------------------------------------------------------------------

class LlmscopeAddon:
    def __init__(self) -> None:
        self.client = IngestClient()

    def request(self, flow) -> None:  # type: ignore[no-untyped-def]
        # Snapshot start time on the flow for later use.
        flow.metadata["llmscope_t_start"] = int(time.time() * 1000)

    def response(self, flow) -> None:  # type: ignore[no-untyped-def]
        host = flow.request.pretty_host
        try:
            req_body = flow.request.get_text()
        except Exception:
            req_body = None
        if not (_looks_like_llm_host(host) or _looks_like_llm_body(req_body)):
            return

        try:
            res_body = flow.response.get_text()
        except Exception:
            res_body = None
        ct = (flow.response.headers.get("content-type") or "").lower()
        is_sse = "text/event-stream" in ct
        provider = _detect_provider(host)

        reassembled = None
        if is_sse and res_body:
            r = _reassemble_sse(res_body, provider)
            reassembled = {
                "chunks": r.get("chunks"),
                "usage": r.get("usage"),
            }

        capped_req, req_truncated = _cap_body(req_body)
        capped_res, res_truncated = _cap_body(res_body)

        ts_start = flow.metadata.get("llmscope_t_start") or int(time.time() * 1000)
        ts_end = int(time.time() * 1000)
        event: dict[str, Any] = {
            "ts_start": ts_start,
            "ts_end": ts_end,
            "transport": "sse" if is_sse else "http",
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "request_headers": _mask_headers(dict(flow.request.headers)),
            "request_body": capped_req,
            "status": flow.response.status_code,
            "response_headers": _mask_headers(dict(flow.response.headers)),
            "response_body": capped_res,
            "request_body_truncated": req_truncated,
            "response_body_truncated": res_truncated,
        }
        if reassembled is not None:
            event["reassembled"] = reassembled
        self.client.submit(event)

    def websocket_message(self, flow) -> None:  # type: ignore[no-untyped-def]
        timeline: list[dict[str, Any]] = flow.metadata.setdefault("llmscope_ws", [])
        msg = flow.websocket.messages[-1]
        timeline.append({
            "direction": "client" if msg.from_client else "server",
            "ts": int(time.time() * 1000),
            "text": msg.content if isinstance(msg.content, str) else msg.content.decode("utf-8", errors="ignore"),
        })

    def websocket_end(self, flow) -> None:  # type: ignore[no-untyped-def]
        host = flow.request.pretty_host
        timeline: list[dict[str, Any]] = flow.metadata.get("llmscope_ws") or []
        if not timeline:
            return
        provider = _detect_provider(host)
        if provider != "openai":
            return  # only Realtime API is handled in v1
        ts_start = flow.metadata.get("llmscope_t_start") or timeline[0]["ts"]
        ts_end = timeline[-1]["ts"] if timeline else ts_start
        event: dict[str, Any] = {
            "ts_start": ts_start,
            "ts_end": ts_end,
            "transport": "ws",
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "request_headers": _mask_headers(dict(flow.request.headers)),
            "request_body": json.dumps({"timeline": timeline}),
            "status": flow.response.status_code if flow.response else 101,
            "response_headers": _mask_headers(dict(flow.response.headers)) if flow.response else {},
            "response_body": None,
        }
        self.client.submit(event)


addons = [LlmscopeAddon()]


# ---------------------------------------------------------------------------
# Self-test (importable utilities only — exercised by pytest):
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("llmscope mitmproxy addon — run via `mitmdump -s addon.py`", file=sys.stderr)
    sys.exit(0)
