"""Reason-vector explanation: a short, plain-language account of why a
session was escalated and what would restore trust. Only called for
sessions whose decision isn't "continue" (differentiator #8 in the main
doc — explainable escalations, not a bare score), which also keeps LLM
spend down to the fraction of sessions that actually get flagged.

Provider priority: Groq (free tier, fast, OpenAI-compatible — the
default so the demo needs no paid key) -> Anthropic (if explicitly
configured) -> a clearly-labeled template fallback so the pipeline
always runs end-to-end even with zero LLM access.

Reads GROQ_API_KEY from the environment OR a root .env file (checking
both GROQ_API_KEY and the lowercase groq_api some .env files use).
"""
import os
from pathlib import Path

try:
    from dotenv import dotenv_values
    _ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
    _DOTENV = dotenv_values(_ENV_FILE) if _ENV_FILE.exists() else {}
except ImportError:
    _DOTENV = {}

try:
    import anthropic
except ImportError:
    anthropic = None

try:
    import requests
except ImportError:
    requests = None


def _env(*names: str) -> str | None:
    for name in names:
        val = os.environ.get(name) or _DOTENV.get(name)
        if val:
            return str(val).strip()
    return None


GROQ_API_KEY = _env("GROQ_API_KEY", "groq_api", "GROQ_API")
ANTHROPIC_API_KEY = _env("ANTHROPIC_API_KEY")

GROQ_MODEL = os.environ.get("REASON_VECTOR_GROQ_MODEL", "qwen/qwen3.8-27b")  # verified available for this key via /v1/models
ANTHROPIC_MODEL = os.environ.get("REASON_VECTOR_MODEL", "claude-haiku-5-5")

SYSTEM_PROMPT = (
    "You write short, plain-language explanations for a delivery-rider trust system. "
    "Given which behavioral signals moved and by how much, explain in 2-3 sentences, to the rider, "
    "why their session needs a quick check, and what they can do about it. Be factual and non-accusatory — "
    "the system flags patterns, not guilt. Never claim certainty the data doesn't support. "
    "End with one concrete next step (e.g. 'a quick selfie check will confirm it's you')."
)


def _build_prompt(session: dict, result: dict, p_values: dict) -> str:
    # ascending: lowest p-value = most surprising relative to the rider's history
    moved = sorted(p_values.items(), key=lambda kv: kv[1])
    signal_lines = "\n".join(f"- {name}: p-value {p:.3f} (lower = more unusual)" for name, p in moved)
    return (
        f"Driver: {session['driver_id']}\n"
        f"Quadrant: {result['quadrant']} (decision: {result['decision']})\n"
        f"Context continuity: {result['context_continuity']} (1.0 = device/network/zone all match history)\n"
        f"Behavior continuity: {result['behavior_continuity']} (Fisher-fused p-value; 1.0 = behavior fully matches history, "
        f"small = multiple signals jointly look unusual)\n"
        f"Per-signal conformal p-values:\n{signal_lines}\n\n"
        f"Write the rider-facing explanation now."
    )


def _fallback_explanation(session: dict, result: dict, p_values: dict) -> dict:
    moved = sorted(p_values.items(), key=lambda kv: kv[1])
    top_signal, top_p = moved[0]
    text = (
        f"[template fallback — no LLM key configured, this is NOT a generated explanation] "
        f"Session flagged as '{result['quadrant']}' (decision: {result['decision']}). "
        f"Context continuity {result['context_continuity']}, behavior continuity {result['behavior_continuity']}. "
        f"Most unusual signal: {top_signal} (p={top_p:.3f})."
    )
    return {"explanation": text, "model": None, "generated": False, "provider": None}


def _explain_via_groq(prompt: str) -> str:
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "max_tokens": 250,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _explain_via_anthropic(prompt: str) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=250,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def explain(session: dict, result: dict, p_values: dict) -> dict:
    """Call only when result['decision'] != 'continue' — the caller owns
    that cost-control check, this function doesn't skip silently so a
    caller bug doesn't go unnoticed. `p_values` is the same
    {signal_name: conformal p-value} dict passed to
    ml.combiner.two_axis.behavior_continuity (lower p = more unusual)."""
    if result["decision"] == "continue":
        raise ValueError("explain() should only be called for escalated sessions (decision != 'continue')")

    prompt = _build_prompt(session, result, p_values)

    if requests is not None and GROQ_API_KEY:
        try:
            text = _explain_via_groq(prompt)
            return {"explanation": text, "model": GROQ_MODEL, "generated": True, "provider": "groq"}
        except Exception as e:
            # fall through to the next provider rather than failing the whole request
            print(f"[reason_vector] Groq call failed ({e}), falling back")

    if anthropic is not None and ANTHROPIC_API_KEY:
        try:
            text = _explain_via_anthropic(prompt)
            return {"explanation": text, "model": ANTHROPIC_MODEL, "generated": True, "provider": "anthropic"}
        except Exception as e:
            print(f"[reason_vector] Anthropic call failed ({e}), falling back")

    return _fallback_explanation(session, result, p_values)
