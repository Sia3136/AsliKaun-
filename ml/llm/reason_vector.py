"""Reason-vector explanation: a short, plain-language account of why a
session was escalated and what would restore trust. Only called for
sessions whose decision isn't "continue" (differentiator #8 in the main
doc — explainable escalations, not a bare score), which also keeps LLM
spend down to the fraction of sessions that actually get flagged.

Needs ANTHROPIC_API_KEY set in the environment and the `anthropic`
package installed. With neither, `explain()` falls back to a template
string so the rest of the pipeline (and any demo) still runs end-to-end
without a live key — that fallback is clearly labeled as such, never
presented as a generated explanation.
"""
import os

try:
    import anthropic
except ImportError:
    anthropic = None

DEFAULT_MODEL = os.environ.get("REASON_VECTOR_MODEL", "claude-haiku-5-5")

SYSTEM_PROMPT = (
    "You write short, plain-language explanations for a delivery-rider trust system. "
    "Given which behavioral signals moved and by how much, explain in 2-3 sentences, to the rider, "
    "why their session needs a quick check, and what they can do about it. Be factual and non-accusatory — "
    "the system flags patterns, not guilt. Never claim certainty the data doesn't support. "
    "End with one concrete next step (e.g. 'a quick selfie check will confirm it's you')."
)


def _build_prompt(session: dict, result: dict, scorer_outputs: dict) -> str:
    moved = sorted(scorer_outputs.items(), key=lambda kv: -kv[1])
    signal_lines = "\n".join(f"- {name}: anomaly score {score:.2f}" for name, score in moved)
    return (
        f"Driver: {session['driver_id']}\n"
        f"Quadrant: {result['quadrant']} (decision: {result['decision']})\n"
        f"Context continuity: {result['context_continuity']} (1.0 = device/network/zone all match history)\n"
        f"Behavior continuity: {result['behavior_continuity']} (1.0 = behavior fully matches history)\n"
        f"Per-signal anomaly scores:\n{signal_lines}\n\n"
        f"Write the rider-facing explanation now."
    )


def _fallback_explanation(session: dict, result: dict, scorer_outputs: dict) -> dict:
    moved = sorted(scorer_outputs.items(), key=lambda kv: -kv[1])
    top_signal, top_score = moved[0]
    text = (
        f"[template fallback — no ANTHROPIC_API_KEY configured, this is NOT a generated explanation] "
        f"Session flagged as '{result['quadrant']}' (decision: {result['decision']}). "
        f"Context continuity {result['context_continuity']}, behavior continuity {result['behavior_continuity']}. "
        f"Most anomalous signal: {top_signal} ({top_score:.2f})."
    )
    return {"explanation": text, "model": None, "generated": False}


def explain(session: dict, result: dict, scorer_outputs: dict, model: str = DEFAULT_MODEL) -> dict:
    """Call only when result['decision'] != 'continue' — the caller owns
    that cost-control check, this function doesn't skip silently so a
    caller bug doesn't go unnoticed."""
    if result["decision"] == "continue":
        raise ValueError("explain() should only be called for escalated sessions (decision != 'continue')")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic is None or not api_key:
        return _fallback_explanation(session, result, scorer_outputs)

    client = anthropic.Anthropic(api_key=api_key)
    prompt = _build_prompt(session, result, scorer_outputs)
    response = client.messages.create(
        model=model,
        max_tokens=250,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    return {"explanation": text, "model": model, "generated": True}
