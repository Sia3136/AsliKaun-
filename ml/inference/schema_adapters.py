"""Converts the FROZEN session schema (agreed hour 0-1, see the main
doc's System Architecture / Phase 0 data contract) into the input
formats each trained model actually expects.

SCHEMA GAP FOUND WHILE WIRING THIS UP — read before integrating with
backend:

The frozen schema's `touch_events` is one entry per COMPLETED gesture:
    {"type": "tap|swipe", "x", "y", "pressure", "area", "duration_ms", "t"}
A single (x, y) point per gesture. The touch triplet encoder
(ml/models/touch_triplet_encoder.py) was trained on H-MOG's raw
per-SAMPLE stream (many (x, y, pressure, t) points per gesture, with
DOWN/MOVE/UP actions) and gets its EER improvement (0.408 -> 0.352)
specifically from velocity/curvature/pressure-slope features computed
from that path — none of which are computable from a single point.
With the schema as frozen, `touch_stroke_sequence_from_schema` below
can only reconstruct duration, pressure, and area per gesture; velocity,
peak velocity, acceleration, direction, and curvature all come back as
0.0. The model will still run, but it will NOT perform at the measured
0.352 EER with degraded-to-zero features — this needs either a schema
extension (each touch_event carries a `path: [{x, y, pressure, t}, ...]`
of raw samples during the gesture, which is what the mobile SDK would
actually log) or an accepted, documented EER regression. Flag this to
backend/frontend before wiring real traffic through this.

Similarly, GPS: the frozen schema's `gps` is a flat list of
{lat, lng, t} points for the whole session, not segmented into
delivery "waves" with action points the way ODIDMob_Routes is. The
validated classical GPS model (EER 0.397) was trained on ODIDMob's
23-dim per-wave summary, which includes platform-specific fields
(rider_lvl, max_load, weather grade) that don't exist in the frozen
schema at all. `gps_features_from_schema` below instead computes a
GeoLife-style feature set directly from the raw point stream (speed,
acceleration, turn-rate stats) — reasonable, but a DIFFERENT feature
set than the one actually evaluated, so the 0.397 EER number does not
directly transfer to this production path. Re-evaluate once real
production GPS data exists.
"""
from datetime import datetime, timezone

import numpy as np

from ml.features.touch_features import STROKE_FEATURE_NAMES


def _parse_ts(iso_string: str) -> float:
    """ISO8601 -> unix milliseconds."""
    return datetime.fromisoformat(iso_string.replace("Z", "+00:00")).timestamp() * 1000.0


def operational_features_from_schema(session: dict) -> np.ndarray:
    ts = datetime.fromisoformat(session["timestamp"].replace("Z", "+00:00"))
    hour = ts.hour + ts.minute / 60
    return np.array([
        float(session["accept_latency_ms"]),
        float(np.sin(2 * np.pi * hour / 24)),
        float(np.cos(2 * np.pi * hour / 24)),
    ])


def motion_features_from_schema(session: dict):
    """Returns the raw array shape ml/features/motion_features.py's
    session_motion_features() expects (Systime, _, _, X, Y, Z, _), or
    None if there's not enough accel data."""
    from ml.features.motion_features import session_motion_features

    accel = session.get("accel", [])
    if len(accel) < 20:
        return None
    rows = np.array([
        [_parse_ts(a["t"]), 0.0, 0.0, a["x"], a["y"], a["z"], 0.0]
        for a in accel
    ])
    return session_motion_features(rows)


def touch_stroke_sequence_from_schema(session: dict) -> np.ndarray | None:
    """Degraded stroke-feature sequence from the frozen schema's one-
    point-per-gesture touch_events — see this module's docstring for
    what's lost (velocity/curvature/pressure-slope all come back 0.0)
    versus what the model was actually trained on."""
    events = session.get("touch_events", [])
    if len(events) < 3:
        return None
    idx = {name: i for i, name in enumerate(STROKE_FEATURE_NAMES)}
    vecs = []
    for e in events:
        v = np.zeros(len(STROKE_FEATURE_NAMES))
        v[idx["duration_ms"]] = e.get("duration_ms", 0.0)
        v[idx["pressure_mean"]] = e.get("pressure", 0.0)
        v[idx["area_mean"]] = e.get("area", 0.0)
        # path_length_px, velocity_mean, velocity_peak, accel_mean_abs,
        # direction_rad, curvature_std, pressure_var, pressure_slope all
        # stay 0.0 — not computable from a single (x, y) point.
        vecs.append(v)
    return np.stack(vecs).astype(np.float32)


def gps_features_from_schema(session: dict) -> np.ndarray | None:
    """GeoLife-style speed/turn-rate stats directly from the raw point
    stream — see this module's docstring for why this is a DIFFERENT
    feature set than the validated ODIDMob-based model."""
    points = session.get("gps", [])
    if len(points) < 5:
        return None
    lat = np.array([p["lat"] for p in points])
    lon = np.array([p["lng"] for p in points])
    t = np.array([_parse_ts(p["t"]) / 1000.0 for p in points])  # seconds

    r = 6371000.0
    phi1, phi2 = np.radians(lat[:-1]), np.radians(lat[1:])
    dphi = np.radians(lat[1:] - lat[:-1])
    dlambda = np.radians(lon[1:] - lon[:-1])
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    dist = 2 * r * np.arcsin(np.sqrt(np.clip(a, 0, 1)))

    dt = np.diff(t)
    dt[dt == 0] = np.nan
    speed = dist / dt
    speed = speed[np.isfinite(speed) & (speed < 50)]
    if speed.size < 3:
        return None
    accel = np.diff(speed)
    bearing = np.arctan2(np.diff(lon), np.diff(lat))
    turn = np.mod(np.diff(bearing) + np.pi, 2 * np.pi) - np.pi

    return np.array([
        float(np.mean(speed)), float(np.std(speed)),
        float(np.mean(np.abs(accel))) if accel.size else 0.0,
        float(np.std(turn)) if turn.size else 0.0,
    ])
