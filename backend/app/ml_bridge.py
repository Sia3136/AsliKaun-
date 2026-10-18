"""ML Bridge connecting the FastAPI backend with the ML workstream.

Provides:
- Multi-signal feature extraction (operational, touch, motion)
- Behavioral continuity and anomaly scoring
- Context continuity via Two-Axis Combiner
- Quadrant classification (stable, legit_change, handoff_signature, ambiguous)
- LLM Reason Vector generation (via Claude or template fallback)
- Safe fallback to heuristic scoring if signals are sparse
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

# Ensure project root (containing `ml/`) is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Optional imports from ml workstream.
# NOTE: deliberately NOT importing two_axis.behavior_continuity (Fisher
# p-value fusion) here — it expects real conformal p-values from
# per-rider-fitted models (ml/inference/rider_model_bundle.py), not the
# ad-hoc relative-difference anomaly scores compute_signal_anomalies()
# produces below. Feeding the latter into Fisher's method would silently
# misuse a statistical tool that assumes a specific input distribution.
try:
    from ml.combiner.two_axis import (
        ContextBaseline,
        classify as ml_classify,
        context_continuity as ml_context_continuity,
    )
    ML_COMBINER_AVAILABLE = True
except ImportError:
    ML_COMBINER_AVAILABLE = False

try:
    from ml.llm.reason_vector import explain as ml_explain
    ML_LLM_AVAILABLE = True
except ImportError:
    ML_LLM_AVAILABLE = False

try:
    from ml.inference.rider_model_bundle import RiderModelBundle
    ML_RIDER_BUNDLE_AVAILABLE = True
except ImportError:
    ML_RIDER_BUNDLE_AVAILABLE = False

# Minimum raw session history (from the `sessions` table) before attempting
# the REAL trained models — below this, RiderModelBundle.fit()'s own
# missing-signal / insufficient-data skip would trigger for every signal
# anyway, so there's no point trying; the heuristic fallback runs instead.
# See ml/README.md's "Per-rider threshold calibration" for why even this
# is still a population-fallback regime, not the full per-rider guarantee,
# until a rider has ~100 sessions.
MIN_HISTORY_FOR_REAL_MODELS = 15

# ml/combiner/two_axis.py's quadrant names match this backend's own exactly;
# only the decision strings differ (this backend's vocabulary is what
# main.py's review-queue routing depends on, e.g.
# `decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause")`).
_QUADRANT_TO_BACKEND_DECISION = {
    "stable": "continue",
    "legit_change": "rebaseline",
    "handoff_signature": "challenge_at_safe_pause",
    "ambiguous": "step_up_check_at_safe_pause",
}


def extract_operational_features(payload: Any) -> dict[str, float | None]:
    """Extract operational features: latency and cyclical hour of day."""
    latency = getattr(payload, "accept_latency_ms", None)
    ts = getattr(payload, "timestamp", None) or datetime.now(timezone.utc)
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(timezone.utc)

    hour = ts.hour + ts.minute / 60.0
    return {
        "accept_latency_ms": float(latency) if latency is not None else None,
        "hour_of_day": round(hour, 2),
        "hour_sin": round(float(np.sin(2 * np.pi * hour / 24.0)), 4),
        "hour_cos": round(float(np.cos(2 * np.pi * hour / 24.0)), 4),
    }


def extract_motion_features(payload: Any) -> dict[str, float | None]:
    """Extract motion features from raw or structured accelerometer/gyro data."""
    raw_accel = getattr(payload, "accel", []) or []
    raw_gyro = getattr(payload, "gyro", []) or []

    # Handle both list of numbers and list of dicts with x, y, z
    if raw_accel and isinstance(raw_accel[0], dict):
        xs = [float(a.get("x", 0.0)) for a in raw_accel]
        ys = [float(a.get("y", 0.0)) for a in raw_accel]
        zs = [float(a.get("z", 0.0)) for a in raw_accel]
        mags = [np.sqrt(x**2 + y**2 + z**2) for x, y, z in zip(xs, ys, zs)]
        accel_mean = float(np.mean(mags))
        accel_std = float(np.std(mags)) if len(mags) > 1 else 0.0
        accel_x_mean, accel_y_mean, accel_z_mean = float(np.mean(xs)), float(np.mean(ys)), float(np.mean(zs))
    elif raw_accel:
        nums = [float(x) for x in raw_accel]
        accel_mean = float(np.mean(nums))
        accel_std = float(np.std(nums)) if len(nums) > 1 else 0.0
        accel_x_mean, accel_y_mean, accel_z_mean = accel_mean, 0.0, 0.0
    else:
        accel_mean, accel_std = None, None
        accel_x_mean, accel_y_mean, accel_z_mean = None, None, None

    if raw_gyro:
        gyro_nums = [float(x) for x in raw_gyro]
        gyro_mean = float(np.mean(gyro_nums))
    else:
        gyro_mean = None

    return {
        "accel_mean": round(accel_mean, 4) if accel_mean is not None else None,
        "accel_std": round(accel_std, 4) if accel_std is not None else None,
        "accel_x_mean": round(accel_x_mean, 4) if accel_x_mean is not None else None,
        "accel_y_mean": round(accel_y_mean, 4) if accel_y_mean is not None else None,
        "accel_z_mean": round(accel_z_mean, 4) if accel_z_mean is not None else None,
        "gyro_mean": round(gyro_mean, 4) if gyro_mean is not None else None,
    }


def extract_touch_features(payload: Any) -> dict[str, float | None]:
    """Extract touch biometric features: pressure, tap rhythm, contact size."""
    touch_events = getattr(payload, "touch_events", []) or []
    if not touch_events:
        return {
            "touch_count": 0,
            "pressure_mean": None,
            "pressure_std": None,
            "interval_mean_ms": None,
        }

    pressures = [float(t["pressure"]) for t in touch_events if "pressure" in t]
    intervals = []
    offsets = [float(t["t_offset_ms"]) for t in touch_events if "t_offset_ms" in t]
    if len(offsets) > 1:
        intervals = list(np.diff(np.sort(offsets)))

    return {
        "touch_count": len(touch_events),
        "pressure_mean": round(float(np.mean(pressures)), 4) if pressures else None,
        "pressure_std": round(float(np.std(pressures)), 4) if len(pressures) > 1 else 0.0 if pressures else None,
        "interval_mean_ms": round(float(np.mean(intervals)), 2) if intervals else None,
    }


def compute_signal_anomalies(
    current: dict[str, Any], baseline: dict[str, Any]
) -> dict[str, float]:
    """Calculate per-signal normalized anomaly score in [0.0, 1.0]."""
    anomalies: dict[str, float] = {}

    # 1. Operational anomaly (latency + hour of day)
    op_cur = current.get("operational", {})
    op_base = baseline.get("operational", {})
    cur_lat = op_cur.get("accept_latency_ms")
    base_lat = op_base.get("accept_latency_ms")
    if cur_lat is not None and base_lat is not None:
        denom = max(abs(base_lat), 500.0)
        lat_diff = abs(cur_lat - base_lat) / denom
        hour_cur = op_cur.get("hour_of_day", 12.0)
        hour_base = op_base.get("hour_of_day", 12.0)
        hour_diff = min(abs(hour_cur - hour_base), 24.0 - abs(hour_cur - hour_base)) / 12.0
        anomalies["operational"] = float(np.clip(0.6 * min(lat_diff, 1.0) + 0.4 * hour_diff, 0.0, 1.0))

    # 2. Touch anomaly (pressure + rhythm)
    touch_cur = current.get("touch", {})
    touch_base = baseline.get("touch", {})
    cur_p = touch_cur.get("pressure_mean")
    base_p = touch_base.get("pressure_mean")
    if cur_p is not None and base_p is not None:
        p_diff = abs(cur_p - base_p) / max(base_p, 0.1)
        cur_int = touch_cur.get("interval_mean_ms")
        base_int = touch_base.get("interval_mean_ms")
        int_diff = (abs(cur_int - base_int) / max(base_int, 50.0)) if (cur_int and base_int) else 0.0
        anomalies["touch"] = float(np.clip(0.7 * min(p_diff, 1.0) + 0.3 * min(int_diff, 1.0), 0.0, 1.0))

    # 3. Motion anomaly (accel mean magnitude + gyro)
    motion_cur = current.get("motion", {})
    motion_base = baseline.get("motion", {})
    cur_acc = motion_cur.get("accel_mean")
    base_acc = motion_base.get("accel_mean")
    if cur_acc is not None and base_acc is not None:
        acc_diff = abs(cur_acc - base_acc) / max(abs(base_acc), 0.5)
        anomalies["motion"] = float(np.clip(min(acc_diff, 1.0), 0.0, 1.0))

    return anomalies


def evaluate_session_ml(
    payload: Any,
    driver_history: dict[str, Any],
) -> dict[str, Any]:
    """Execute end-to-end ML evaluation on an incoming session payload.
    
    Returns structured results matching backend contracts and Two-Axis Combiner logic.
    """
    # 1. Feature extraction
    op_feats = extract_operational_features(payload)
    touch_feats = extract_touch_features(payload)
    motion_feats = extract_motion_features(payload)

    current_behavior = {
        "operational": op_feats,
        "touch": touch_feats,
        "motion": motion_feats,
    }

    current_context = {
        "device_id": getattr(payload, "device_id", None),
        "ip_subnet": getattr(payload, "ip_subnet", None),
        "zone": getattr(payload, "zone", None),
    }

    # Historical baselines
    fast_baseline = driver_history.get("fast_behavior", {})
    anchor_baseline = driver_history.get("anchor_behavior", {})
    known_contexts = driver_history.get("known_contexts", [])

    # 2. Context Continuity
    if known_contexts:
        known_devices = {c.get("device_id") for c in known_contexts if c.get("device_id")}
        known_subnets = {c.get("ip_subnet") for c in known_contexts if c.get("ip_subnet")}
        known_zones = {c.get("zone") for c in known_contexts if c.get("zone")}

        if ML_COMBINER_AVAILABLE:
            baseline_ctx = ContextBaseline(device_ids=known_devices, ip_subnets=known_subnets, zones=known_zones)
            session_ctx_dict = {
                "device_id": current_context["device_id"] or "",
                "ip_subnet": current_context["ip_subnet"] or "",
                "zone": current_context["zone"] or "",
            }
            context_score = ml_context_continuity(session_ctx_dict, baseline_ctx)
        else:
            matches = 0
            total = 0
            if current_context["device_id"]:
                matches += 1 if current_context["device_id"] in known_devices else 0
                total += 1
            if current_context["ip_subnet"]:
                matches += 1 if current_context["ip_subnet"] in known_subnets else 0
                total += 1
            if current_context["zone"]:
                matches += 1 if current_context["zone"] in known_zones else 0
                total += 1
            context_score = (matches / total) if total > 0 else 1.0
    else:
        context_score = 1.0

    context_axis = "stable" if context_score >= 0.6 else "changed"

    # 3. Behavioral Continuity against Fast & Frozen Baselines
    fast_anomalies = compute_signal_anomalies(current_behavior, fast_baseline) if fast_baseline else {}
    anchor_anomalies = compute_signal_anomalies(current_behavior, anchor_baseline) if anchor_baseline else {}

    # Dual-timescale: conservative anomaly is the max anomaly across fast & frozen baselines
    combined_signals: dict[str, float] = {}
    all_keys = set(fast_anomalies.keys()).union(anchor_anomalies.keys())
    for k in all_keys:
        val_fast = fast_anomalies.get(k, 0.0)
        val_anchor = anchor_anomalies.get(k, 0.0)
        combined_signals[k] = round(max(val_fast, val_anchor), 3)

    if combined_signals:
        mean_anomaly = sum(combined_signals.values()) / len(combined_signals)
        behavior_score = round(float(np.clip(1.0 - mean_anomaly, 0.0, 1.0)), 3)
        behavior_axis = "stable" if behavior_score >= 0.6 else "changed"
    else:
        behavior_score = None
        behavior_axis = "insufficient_evidence"

    # 4. Two-Axis Decision Matrix
    # Single source of truth: ml/combiner/two_axis.py's classify(), not a
    # hand-duplicated copy of its if/elif logic (the two had already drifted —
    # this file's decision STRINGS differ from two_axis.py's, e.g.
    # "challenge_at_safe_pause" vs. two_axis.py's "escalate_challenge" — so we
    # take classify()'s QUADRANT as authoritative and translate it to this
    # backend's own decision vocabulary, which main.py's review-queue routing
    # already depends on in several places; the quadrant NAMES already match
    # exactly between both systems, only the decision strings differ).
    #
    # behavior_alpha=0.6 here, NOT the 0.29 measured in ml/README.md for real
    # conformal p-values from trained per-rider models: that calibration is
    # specific to a true p-value's uniform-under-null distribution.
    # `behavior_score` here comes from compute_signal_anomalies() — a mean of
    # ad-hoc relative differences against two flat fast/anchor snapshots, a
    # structurally different, uncalibrated score. 0.6 matches the scale this
    # heuristic actually produces; swapping in 0.29 without re-deriving it for
    # this specific formula would silently make the heuristic far too
    # permissive (it flags almost nothing as changed), not more correct.
    if behavior_axis == "insufficient_evidence":
        quadrant = "baseline_established"
        decision = "continue"
        reasons = ["Session recorded; initializing multi-modal behavioral baseline"]
    elif ML_COMBINER_AVAILABLE:
        combiner_result = ml_classify(context_score, behavior_score, context_threshold=0.6, behavior_alpha=0.6)
        quadrant = combiner_result["quadrant"]
        decision = _QUADRANT_TO_BACKEND_DECISION[quadrant]
        reasons = [combiner_result["meaning"]]
    elif context_axis == "stable" and behavior_axis == "stable":
        quadrant = "stable"
        decision = "continue"
        reasons = ["Context and multi-modal behavior match verified history"]
    elif context_axis == "changed" and behavior_axis == "stable":
        quadrant = "legit_change"
        decision = "rebaseline"
        reasons = ["Context changed (device/network/zone) while physical behavior remained consistent — legitimate change"]
    elif context_axis == "stable" and behavior_axis == "changed":
        quadrant = "handoff_signature"
        decision = "challenge_at_safe_pause"
        reasons = ["Known device/zone with anomalous behavior signature — potential unauthorized handoff"]
    else:
        quadrant = "ambiguous"
        decision = "step_up_check_at_safe_pause"
        reasons = ["Both context and behavioral patterns shifted — step-up verification recommended"]

    # 5. LLM Reason-Vector Generation (for escalated sessions)
    reason_vector: dict[str, Any] | None = None
    if decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause"):
        session_meta = {
            "driver_id": getattr(payload, "driver_id", "unknown"),
        }
        res_meta = {
            "quadrant": quadrant,
            "decision": decision,
            "context_continuity": round(context_score, 3) if context_score is not None else 1.0,
            "behavior_continuity": behavior_score if behavior_score is not None else 0.5,
        }
        if ML_LLM_AVAILABLE:
            try:
                reason_vector = ml_explain(session_meta, res_meta, combined_signals)
                if reason_vector and reason_vector.get("explanation"):
                    reasons.append(f"Reason Vector: {reason_vector['explanation']}")
            except Exception as e:
                reasons.append(f"Reason Vector fallback: Escalated due to signals {combined_signals} ({e})")
        else:
            top_sig = max(combined_signals.items(), key=lambda kv: kv[1]) if combined_signals else ("general", 0.5)
            explanation_text = (
                f"Session flagged for safety check. Context continuity: {res_meta['context_continuity']}, "
                f"behavior continuity: {res_meta['behavior_continuity']}. Highest anomaly: {top_sig[0]} ({top_sig[1]:.2f}). "
                f"A quick check will verify it's you."
            )
            reason_vector = {"explanation": explanation_text, "model": None, "generated": False}
            reasons.append(f"Reason Vector: {explanation_text}")

    return {
        "context_score": round(context_score, 3) if context_score is not None else None,
        "behavior_score": behavior_score,
        "context_axis": context_axis,
        "behavior_axis": behavior_axis,
        "quadrant": quadrant,
        "decision": decision,
        "signals": combined_signals,
        "reasons": reasons,
        "reason_vector": reason_vector,
        "current_behavior": current_behavior,
        "current_context": current_context,
        "model_status": "ml_two_axis_fusion",
    }


def evaluate_session_with_real_models(payload: Any, history_payloads: list[dict]) -> dict[str, Any] | None:
    """Scores with the REAL validated trained models
    (ml/inference/rider_model_bundle.py — the ones that actually won on
    real H-MOG/ODIDMob data, see ml/README.md's Phase 2 results)
    instead of the heuristic in evaluate_session_ml() above. Returns
    None when there isn't enough raw history yet to fit a per-rider
    model; the caller falls back to the heuristic in that case.

    `history_payloads`: this driver's past raw session payloads from the
    `sessions` table (chronological, oldest first), NOT including the
    session currently being scored — each one is exactly a prior
    `SessionIngest.model_dump(mode="json")`, which already matches the
    frozen schema RiderModelBundle expects.

    Known, named limitations (not hidden): refits the bundle from
    scratch on every call (no caching — fine at demo scale, a real cost
    at production scale); GPS uses the unvalidated GeoLife-style
    stopgap feature set, not the ODIDMob-validated one (see
    rider_model_bundle.py's own docstring); touch runs on a degraded
    feature set until the mobile SDK sends full per-gesture `path` data.
    """
    if not ML_RIDER_BUNDLE_AVAILABLE or len(history_payloads) < MIN_HISTORY_FOR_REAL_MODELS:
        return None

    split = int(len(history_payloads) * 0.7)
    enroll, calib = history_payloads[:split], history_payloads[split:]
    if len(enroll) < 5 or len(calib) < 5:
        return None

    try:
        bundle = RiderModelBundle.fit(enroll, calib)
    except Exception as e:
        print(f"[ml_bridge] RiderModelBundle.fit failed ({e}), falling back to heuristic")
        return None

    current_session = {
        "driver_id": getattr(payload, "driver_id", None),
        "session_id": "current",
        "timestamp": payload.timestamp.isoformat(),
        "device_id": payload.device_id,
        "ip_subnet": payload.ip_subnet,
        "zone": payload.zone,
        "accel": payload.accel,
        "touch_events": payload.touch_events,
        "gps": payload.gps,
        "accept_latency_ms": payload.accept_latency_ms,
    }

    try:
        result = bundle.score(current_session, generate_reason=False)
    except Exception as e:
        print(f"[ml_bridge] RiderModelBundle.score failed ({e}), falling back to heuristic")
        return None

    quadrant = result["quadrant"]
    if quadrant == "insufficient_evidence":
        return None  # no signal could be scored at all — let the heuristic try instead

    decision = _QUADRANT_TO_BACKEND_DECISION.get(quadrant, "continue")
    # p-values (high = normal) -> 0-1 "anomaly-like" scale for the existing dashboard display convention
    signals = {k: round(1.0 - v, 3) for k, v in result.get("p_values", {}).items()}

    behavior_continuity = result.get("behavior_continuity")
    reasons = [
        f"Real trained-model verdict: {quadrant} "
        f"(context_continuity={result['context_continuity']}, "
        f"behavior_continuity={round(behavior_continuity, 3) if behavior_continuity is not None else None})"
    ]

    reason_vector: dict[str, Any] | None = None
    if decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause") and ML_LLM_AVAILABLE:
        try:
            session_meta = {"driver_id": getattr(payload, "driver_id", "unknown")}
            reason_vector = ml_explain(session_meta, result, result.get("p_values", {}))
            if reason_vector and reason_vector.get("explanation"):
                reasons.append(f"Reason Vector: {reason_vector['explanation']}")
        except Exception as e:
            reasons.append(f"Reason vector failed: {e}")

    return {
        "context_score": result["context_continuity"],
        "behavior_score": round(behavior_continuity, 3) if behavior_continuity is not None else None,
        "context_axis": "stable" if result["context_continuity"] >= 0.6 else "changed",
        "behavior_axis": quadrant,  # the real quadrant carries more information than a binary stable/changed axis
        "quadrant": quadrant,
        "decision": decision,
        "signals": signals,
        "reasons": reasons,
        "reason_vector": reason_vector,
        "current_behavior": {},
        "current_context": {"device_id": payload.device_id, "ip_subnet": payload.ip_subnet, "zone": payload.zone},
        "model_status": "ml_real_trained_models",
        "threshold_info": result.get("threshold_info"),
    }
