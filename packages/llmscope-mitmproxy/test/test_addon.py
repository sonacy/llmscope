"""Pure unit tests for the addon's pure helpers — no mitmproxy import needed."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

ADDON_PATH = Path(__file__).resolve().parent.parent / "addon.py"
spec = importlib.util.spec_from_file_location("llmscope_addon", ADDON_PATH)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
sys.modules["llmscope_addon"] = mod
spec.loader.exec_module(mod)


def test_ulid_format():
    a = mod._ulid()
    assert a.startswith("evt_")
    assert len(a) == len("evt_") + 26


def test_ulid_monotonic():
    a = mod._ulid(1)
    b = mod._ulid(2)
    assert a < b


def test_mask_headers_authorization():
    out = mod._mask_headers({"Authorization": "Bearer sk-leak", "x-api-key": "k", "content-type": "json"})
    assert out["Authorization"] == mod.MASK_TOKEN
    assert out["x-api-key"] == mod.MASK_TOKEN
    assert out["content-type"] == "json"


def test_cap_body_below_limit_passes():
    out, trunc = mod._cap_body("hello")
    assert out == "hello"
    assert trunc is False


def test_cap_body_oversize_truncates():
    big = "x" * (mod.BODY_CAP_BYTES + 100)
    out, trunc = mod._cap_body(big)
    assert trunc is True
    assert out.endswith(mod.TRUNC_MARKER)
    assert len(out.encode("utf-8")) <= mod.BODY_CAP_BYTES


def test_looks_like_llm_host():
    assert mod._looks_like_llm_host("api.openai.com")
    assert mod._looks_like_llm_host("api.anthropic.com")
    assert not mod._looks_like_llm_host("example.com")


def test_looks_like_llm_body():
    assert mod._looks_like_llm_body('{"model":"gpt-4o","messages":[]}')
    assert not mod._looks_like_llm_body('{"foo":"bar"}')
    assert not mod._looks_like_llm_body("not json")
    assert not mod._looks_like_llm_body(None)


def test_detect_provider():
    assert mod._detect_provider("api.openai.com") == "openai"
    assert mod._detect_provider("api.anthropic.com") == "anthropic"
    assert mod._detect_provider("generativelanguage.googleapis.com") == "google"
    assert mod._detect_provider("bedrock-runtime.us-east-1.amazonaws.com") == "bedrock"
    assert mod._detect_provider("example.com") == "unknown"


def test_reassemble_sse_openai():
    raw = (
        'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"there"}}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n'
        'data: [DONE]\n\n'
    )
    r = mod._reassemble_sse(raw, "openai")
    assert r["text"] == "Hi there"
    assert r["finish_reason"] == "stop"
    assert r["usage"]["total_tokens"] == 5


def test_reassemble_sse_anthropic():
    raw = (
        'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n\n'
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}\n\n'
    )
    r = mod._reassemble_sse(raw, "anthropic")
    assert r["text"] == "Hello"
    assert r["finish_reason"] == "end_turn"
    assert r["usage"]["total_tokens"] == 13


def test_reassemble_sse_google():
    raw = (
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n'
        'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":2,"totalTokenCount":5}}\n\n'
    )
    r = mod._reassemble_sse(raw, "google")
    assert r["text"] == "Hello"
    assert r["finish_reason"] == "STOP"
    assert r["usage"]["total_tokens"] == 5
