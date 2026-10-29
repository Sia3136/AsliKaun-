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

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("aslikaun.ml_bridge")

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
    from ml.inference.bundle_store import save_bundle, load_bundle, has_persisted_bundle, list_persisted_bundles
    ML_RIDER_BUNDLE_AVAILABLE = True
except ImportError:
    ML_RIDER_BUNDLE_AVAILABLE = False

try:
    from ml.models.face_verification import cosine_similarity as _face_cosine_similarity, embed_face as _embed_face
    ML_FACE_AVAILABLE = True
except ImportError:
    ML_FACE_AVAILABLE = False


def embed_face_image(image) -> np.ndarray | None:
    """Thin passthrough so main.py doesn't need to import ml.* directly
    (same optional-dependency isolation as the rest of this bridge).
    `image` is a PIL.Image. Returns None if unavailable or no face found."""
    if not ML_FACE_AVAILABLE:
        return None
    return _embed_face(image)


def face_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return _face_cosine_similarity(a, b)

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
    """Extract touch biometric features: pressure, tap rhythm, contact size, and gesture paths."""
    touch_events = getattr(payload, "touch_events", []) or []
    if not touch_events:
        return {
            "touch_count": 0,
            "has_gesture_paths": False,
            "pressure_mean": None,
            "pressure_std": None,
            "interval_mean_ms": None,
            "velocity_mean": None,
            "velocity_peak": None,
            "curvature_std": None,
            "pressure_slope": None,
            "status": "unavailable_no_events",
        }

    pressures = []
    for t in touch_events:
        p = t.get("pressure")
        if p is not None and p > 0 and p != 0.5:
            pressures.append(float(p))
        elif t.get("area") and float(t["area"]) > 0:
            pressures.append(float(np.clip((float(t["area"]) - 150.0) / 750.0, 0.15, 0.95)))
        elif p is not None:
            pressures.append(float(p))
    intervals = []
    offsets = [float(t["t_offset_ms"]) for t in touch_events if "t_offset_ms" in t and t["t_offset_ms"] is not None]
    if len(offsets) > 1:
        intervals = list(np.diff(np.sort(offsets)))

    # Extract gesture sample paths with timestamped coordinates and pressure
    path_velocities = []
    path_curvatures = []
    path_pressure_slopes = []
    has_paths = False

    for event in touch_events:
        path = event.get("path")
        if path and len(path) >= 2:
            has_paths = True
            try:
                xs = [float(p.get("x", 0.0)) for p in path]
                ys = [float(p.get("y", 0.0)) for p in path]
                ps = [float(p.get("pressure", 0.5)) for p in path]
                ts = [float(p.get("t", p.get("t_offset_ms", 0.0))) for p in path]
                dt = max(ts[-1] - ts[0], 1.0)
                dists = [np.sqrt((xs[i]-xs[i-1])**2 + (ys[i]-ys[i-1])**2) for i in range(1, len(path))]
                total_dist = sum(dists)
                path_velocities.append(total_dist / dt)
                if len(path) >= 3:
                    angles = [np.arctan2(ys[i]-ys[i-1], xs[i]-xs[i-1]) for i in range(1, len(path))]
                    d_angles = np.diff(angles)
                    path_curvatures.append(float(np.std(d_angles)))
                if dt > 0:
                    path_pressure_slopes.append((ps[-1] - ps[0]) / dt)
            except Exception:
                pass

    return {
        "touch_count": len(touch_events),
        "has_gesture_paths": has_paths,
        "pressure_mean": round(float(np.mean(pressures)), 4) if pressures else None,
        "pressure_std": round(float(np.std(pressures)), 4) if len(pressures) > 1 else (0.0 if pressures else None),
        "interval_mean_ms": round(float(np.mean(intervals)), 2) if intervals else None,
        "velocity_mean": round(float(np.mean(path_velocities)), 4) if path_velocities else None,
        "velocity_peak": round(float(np.max(path_velocities)), 4) if path_velocities else None,
        "curvature_std": round(float(np.mean(path_curvatures)), 4) if path_curvatures else None,
        "pressure_slope": round(float(np.mean(path_pressure_slopes)), 4) if path_pressure_slopes else None,
        "status": "active_gesture_paths" if has_paths else "sparse_single_points",
    }


def extract_gps_features(payload: Any) -> dict[str, Any]:
    """Extract GPS trajectory features: speeds, turn dynamics, and corridor alignment."""
    gps_points = getattr(payload, "gps", []) or []
    if not gps_points:
        return {
            "gps_count": 0,
            "has_gps": False,
            "speed_mean_mph": None,
            "speed_std_mph": None,
            "status": "unavailable_no_gps_stream",
        }

    speeds = [float(p["speed"]) for p in gps_points if "speed" in p and p["speed"] is not None]
    veh_speed = getattr(payload, "vehicle_speed_mph", None)
    if veh_speed is not None and veh_speed >= 0:
        speeds.append(float(veh_speed))
    return {
        "gps_count": len(gps_points),
        "has_gps": True,
        "speed_mean_mph": round(float(np.mean(speeds)), 2) if speeds else None,
        "speed_std_mph": round(float(np.std(speeds)), 2) if len(speeds) > 1 else (0.0 if speeds else None),
        "status": "active_gps_stream",
    }


def compute_signal_anomalies(
    current: dict[str, Any], baseline: dict[str, Any]
) -> dict[str, float]:
    """Calculate per-signal normalized anomaly score in [0.0, 1.0].
    Missing or sparse signals are treated as 'insufficient evidence' and never penalized."""
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

    # 2. Touch anomaly (only when valid data exists in both current and baseline)
    touch_cur = current.get("touch", {})
    touch_base = baseline.get("touch", {})
    cur_p = touch_cur.get("pressure_mean")
    base_p = touch_base.get("pressure_mean")
    cur_vel = touch_cur.get("velocity_mean")
    base_vel = touch_base.get("velocity_mean")

    if cur_p is not None and base_p is not None:
        p_diff = abs(cur_p - base_p) / max(base_p, 0.1)
        cur_int = touch_cur.get("interval_mean_ms")
        base_int = touch_base.get("interval_mean_ms")
        int_diff = (abs(cur_int - base_int) / max(base_int, 50.0)) if (cur_int and base_int) else 0.0
        # If rich gesture paths exist, incorporate velocity divergence
        if cur_vel is not None and base_vel is not None:
            vel_diff = abs(cur_vel - base_vel) / max(base_vel, 0.05)
            anomalies["touch"] = float(np.clip(0.4 * min(p_diff, 1.0) + 0.3 * min(int_diff, 1.0) + 0.3 * min(vel_diff, 1.0), 0.0, 1.0))
        else:
            anomalies["touch"] = float(np.clip(0.7 * min(p_diff, 1.0) + 0.3 * min(int_diff, 1.0), 0.0, 1.0))

    # 3. Motion anomaly (accel mean magnitude + gyro)
    motion_cur = current.get("motion", {})
    motion_base = baseline.get("motion", {})
    cur_acc = motion_cur.get("accel_mean")
    base_acc = motion_base.get("accel_mean")
    if cur_acc is not None and base_acc is not None:
        acc_diff = abs(cur_acc - base_acc) / max(abs(base_acc), 0.5)
        anomalies["motion"] = float(np.clip(min(acc_diff, 1.0), 0.0, 1.0))

    # 4. GPS speed consistency anomaly
    gps_cur = current.get("gps", {})
    gps_base = baseline.get("gps", {})
    cur_speed = gps_cur.get("speed_mean_mph")
    base_speed = gps_base.get("speed_mean_mph")
    if cur_speed is not None and base_speed is not None and base_speed > 3.0:
        speed_diff = abs(cur_speed - base_speed) / max(base_speed, 10.0)
        anomalies["gps"] = float(np.clip(min(speed_diff, 1.0), 0.0, 1.0))

    return anomalies



def evaluate_session_ml(
    payload: Any,
    driver_history: dict[str, Any],
    calibrated_alpha: float | None = None,
) -> dict[str, Any]:
    """Execute end-to-end ML evaluation on an incoming session payload.
    
    Returns structured results matching backend contracts and Two-Axis Combiner logic.
    """
    # 1. Feature extraction
    op_feats = extract_operational_features(payload)
    touch_feats = extract_touch_features(payload)
    motion_feats = extract_motion_features(payload)
    gps_feats = extract_gps_features(payload)

    current_behavior = {
        "operational": op_feats,
        "touch": touch_feats,
        "motion": motion_feats,
        "gps": gps_feats,
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

    # 4. Two-Axis Decision Matrix with Adaptive Per-Rider Threshold
    if behavior_axis == "insufficient_evidence":
        quadrant = "baseline_established"
        decision = "continue"
        reasons = ["Session recorded; initializing multi-modal behavioral baseline"]
    elif ML_COMBINER_AVAILABLE:
        effective_alpha = calibrated_alpha if calibrated_alpha is not None else 0.6
        combiner_result = ml_classify(context_score, behavior_score, context_threshold=0.6, behavior_alpha=effective_alpha)
        quadrant = combiner_result["quadrant"]
        decision = _QUADRANT_TO_BACKEND_DECISION[quadrant]
        reasons = [combiner_result["meaning"]]
        if calibrated_alpha is not None:
            reasons.append(f"Per-rider adaptive threshold applied: alpha={round(calibrated_alpha, 3)}")
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

    # 6. Pause-Aware Safety Timing Verification
    v_speed = getattr(payload, "vehicle_speed_mph", None)
    if v_speed is None and gps_feats.get("speed_mean_mph") is not None:
        v_speed = gps_feats["speed_mean_mph"]

    safe_pause_info = {
        "is_moving": v_speed is not None and v_speed > 2.0,
        "speed_mph": v_speed,
        "safe_pause_scheduled": decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause") and (v_speed is not None and v_speed > 2.0),
        "scheduled_state": "queued_for_stop" if (v_speed is not None and v_speed > 2.0) else "safe_stop_confirmed",
    }
    if safe_pause_info["safe_pause_scheduled"]:
        reasons.append(f"Safe-pause timing gate: Active speed {v_speed:.1f} mph detected. Challenge deferred to verified standstill (speed = 0 mph) to guarantee rider safety.")

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
        "safe_pause_info": safe_pause_info,
        "model_status": "ml_two_axis_fusion",
    }

# Per-driver fitted-bundle cache. A bundle is only as fresh as the history
# it was fit from, so we key on (driver_id, len(history_payloads)) and
# refit when enough NEW sessions have accumulated since the last fit
# rather than on every single ingest call. Unbounded by design: one
# fleet's driver count is small relative to memory, and each entry is
# evicted implicitly by being overwritten on refit.
_BUNDLE_CACHE: dict[str, tuple[int, "RiderModelBundle"]] = {}
BUNDLE_REFIT_EVERY_N_SESSIONS = 5


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

    Caches the fitted bundle per driver_id (see `_BUNDLE_CACHE`) and only
    refits once `BUNDLE_REFIT_EVERY_N_SESSIONS` new sessions have arrived
    since the last fit, instead of refitting from scratch on every
    request. Still-named limitations: GPS uses the unvalidated GeoLife-
    style stopgap feature set, not the ODIDMob-validated one (see
    rider_model_bundle.py's own docstring); touch now gets full per-
    gesture `path` data from the SDK.
    """
    if not ML_RIDER_BUNDLE_AVAILABLE or len(history_payloads) < MIN_HISTORY_FOR_REAL_MODELS:
        return None

    driver_id = getattr(payload, "driver_id", None)
    cached = _BUNDLE_CACHE.get(driver_id) if driver_id else None
    bundle = None

    if cached is not None and len(history_payloads) - cached[0] < BUNDLE_REFIT_EVERY_N_SESSIONS:
        bundle = cached[1]
    else:
        # Check disk cache if not in memory
        loaded_disk = load_bundle(driver_id) if (driver_id and ML_RIDER_BUNDLE_AVAILABLE) else None
        if loaded_disk is not None and len(history_payloads) - loaded_disk[0] < BUNDLE_REFIT_EVERY_N_SESSIONS:
            bundle = loaded_disk[1]
            if driver_id:
                _BUNDLE_CACHE[driver_id] = (loaded_disk[0], bundle)
        else:
            split = int(len(history_payloads) * 0.7)
            enroll, calib = history_payloads[:split], history_payloads[split:]
            if len(enroll) < 5 or len(calib) < 5:
                if loaded_disk is not None:
                    bundle = loaded_disk[1]
                    if driver_id:
                        _BUNDLE_CACHE[driver_id] = (loaded_disk[0], bundle)
                else:
                    return None
            else:
                try:
                    bundle = RiderModelBundle.fit(enroll, calib)
                except Exception as e:
                    logger.warning("RiderModelBundle.fit failed (%s), falling back to heuristic", e)
                    return None

                if driver_id:
                    _BUNDLE_CACHE[driver_id] = (len(history_payloads), bundle)
                    try:
                        save_bundle(driver_id, bundle, len(history_payloads), {"fitted_at": datetime.now(timezone.utc).isoformat()})
                    except Exception as save_err:
                        logger.warning("Failed to save bundle to disk: %s", save_err)

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
        logger.warning("RiderModelBundle.score failed (%s), falling back to heuristic", e)
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

    # Pause-Aware Safety Timing Verification — same gate as
    # evaluate_session_ml()'s heuristic path (ml_bridge.py's "6." block
    # above). This was missing here before: the real-models path could
    # escalate to a challenge while the driver was still moving, with no
    # signal telling the frontend to defer the challenge to a safe stop.
    v_speed = getattr(payload, "vehicle_speed_mph", None)
    safe_pause_info = {
        "is_moving": v_speed is not None and v_speed > 2.0,
        "speed_mph": v_speed,
        "safe_pause_scheduled": decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause") and (v_speed is not None and v_speed > 2.0),
        "scheduled_state": "queued_for_stop" if (v_speed is not None and v_speed > 2.0) else "safe_stop_confirmed",
    }
    if safe_pause_info["safe_pause_scheduled"]:
        reasons.append(f"Safe-pause timing gate: Active speed {v_speed:.1f} mph detected. Challenge deferred to verified standstill (speed = 0 mph) to guarantee rider safety.")

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
        "safe_pause_info": safe_pause_info,
        "model_status": "ml_real_trained_models",
        "threshold_info": result.get("threshold_info"),
    }


def warmup_bundles() -> int:
    """Preloads all persisted driver bundles from disk into the in-memory bundle cache on server startup."""
    if not ML_RIDER_BUNDLE_AVAILABLE:
        return 0
    warmed = 0
    for driver_id in list_persisted_bundles():
        loaded = load_bundle(driver_id)
        if loaded is not None:
            n_sessions, bundle, _ = loaded
            _BUNDLE_CACHE[driver_id] = (n_sessions, bundle)
            warmed += 1
    if warmed > 0:
        logger.info("[ml_bridge] Prewarmed %d persisted RiderModelBundles into memory cache", warmed)
    return warmed


def evaluate_with_rider_calibration(payload: Any, history: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Use split historical sessions to fit per-rider scorers when history is sufficient.

    This intentionally returns no result until there are enough prior sessions to
    keep enrollment and conformal calibration separate.
    """
    usable = [s for s in history if s.get("accept_latency_ms") is not None]
    if len(usable) < 10:
        return None
    try:
        from ml.inference.rider_model_bundle import RiderModelBundle
        # All signal scorers require at least five calibration observations.
        # Clamp the chronological split so the advertised 10-session minimum
        # yields the minimum viable 5-session enrollment + calibration sets.
        split = min(max(5, int(len(usable) * 0.7)), len(usable) - 5)
        bundle = RiderModelBundle.fit(usable[:split], usable[split:])
        current = payload.model_dump(mode="json") if hasattr(payload, "model_dump") else dict(payload)
        result = bundle.score(current, generate_reason=False)
        if not result.get("p_values"):
            return None
        result["threshold_info"] = bundle.threshold_info
        return result
    except Exception:
        return None

