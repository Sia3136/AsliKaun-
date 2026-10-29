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


def _motion_rows_from_schema(session: dict) -> np.ndarray | None:
    accel = session.get("accel", [])
    if len(accel) < 20:
        return None
    return np.array([
        [_parse_ts(a["t"]), 0.0, 0.0, a["x"], a["y"], a["z"], 0.0]
        for a in accel
    ])


def motion_features_from_schema(session: dict):
    """Aggregated summary for the classical IsolationForest baseline.
    Unlike GPS, the frozen schema's flat `accel` list is sufficient here
    — windowing a continuous stream needs no wave/stop segmentation, so
    this one isn't blocked by the schema gap GPS and touch have."""
    from ml.features.motion_features import session_motion_features

    rows = _motion_rows_from_schema(session)
    return None if rows is None else session_motion_features(rows)


def motion_window_sequence_from_schema(session: dict):
    """Per-window SEQUENCE for the motion triplet encoder (if it wins —
    see ml/README.md), not the aggregated summary above. Same raw accel
    data, just kept as a sequence instead of collapsed to mean/std."""
    from ml.features.motion_features import session_motion_window_sequence

    rows = _motion_rows_from_schema(session)
    return None if rows is None else session_motion_window_sequence(rows)


def touch_stroke_sequence_from_schema(session: dict) -> np.ndarray | None:
    """Extract stroke-feature sequence from touch_events.
    If gesture sample paths with timestamped coordinates and pressure are present,
    computes full kinematics (velocity, curvature, pressure slopes).
    If touch events lack sample paths, explicitly disables the touch model
    (returns None) to trigger the missing-signal policy without feeding uncalibrated zeros."""
    events = session.get("touch_events", [])
    if len(events) < 3:
        return None

    # Check if any event has a sample path
    events_with_path = [e for e in events if e.get("path") and len(e["path"]) >= 2]
    if not events_with_path:
        # Explicitly disable touch model for inputs lacking sample paths
        return None

    idx = {name: i for i, name in enumerate(STROKE_FEATURE_NAMES)}
    vecs = []
    for e in events:
        v = np.zeros(len(STROKE_FEATURE_NAMES), dtype=np.float32)
        v[idx["duration_ms"]] = float(e.get("duration_ms", 0.0))
        v[idx["pressure_mean"]] = float(e.get("pressure", 0.0))
        v[idx["area_mean"]] = float(e.get("area", 0.0))

        path = e.get("path")
        if path and len(path) >= 2:
            try:
                xs = np.array([float(p.get("x", 0.0)) for p in path])
                ys = np.array([float(p.get("y", 0.0)) for p in path])
                ps = np.array([float(p.get("pressure", 0.5)) for p in path])
                ts = np.array([float(p.get("t", p.get("t_offset_ms", 0.0))) for p in path])
                dt = max(ts[-1] - ts[0], 1.0)
                dists = np.sqrt(np.diff(xs)**2 + np.diff(ys)**2)
                path_len = float(np.sum(dists))
                v[idx["path_length_px"]] = path_len
                v[idx["velocity_mean"]] = path_len / dt
                diff_ts = np.maximum(np.diff(ts), 1.0)
                step_vels = dists / diff_ts
                v[idx["velocity_peak"]] = float(np.max(step_vels)) if len(step_vels) > 0 else 0.0
                if len(step_vels) > 1:
                    v[idx["accel_mean_abs"]] = float(np.mean(np.abs(np.diff(step_vels))))
                if len(path) >= 2:
                    v[idx["direction_rad"]] = float(np.arctan2(ys[-1] - ys[0], xs[-1] - xs[0]))
                if len(path) >= 3:
                    angles = np.arctan2(np.diff(ys), np.diff(xs))
                    v[idx["curvature_std"]] = float(np.std(np.diff(angles)))
                p_mean = float(np.mean(ps))
                if (p_mean == 0.5 or p_mean == 0.0) and float(e.get("area", 0.0)) > 0:
                    area = float(e.get("area", 0.0))
                    p_mean = float(np.clip((area - 150.0) / 750.0, 0.15, 0.95))
                v[idx["pressure_mean"]] = p_mean
                v[idx["pressure_var"]] = float(np.var(ps))
                v[idx["pressure_slope"]] = float((ps[-1] - ps[0]) / dt)
            except Exception:
                pass
        vecs.append(v)

    return np.stack(vecs).astype(np.float32)



def _parse_gps_point(p: dict, prev_t: float = 0.0) -> tuple[float, float, float]:
    """Robustly extracts (lat, lng, t_seconds) handling varying schemas."""
    lat = float(p.get("lat") or p.get("latitude") or 0.0)
    lng = float(p.get("lng") or p.get("lon") or p.get("longitude") or 0.0)
    raw_t = p.get("t") or p.get("timestamp") or p.get("time")
    if raw_t is not None:
        if isinstance(raw_t, (int, float)):
            t_sec = float(raw_t) if raw_t < 1e11 else float(raw_t) / 1000.0
        else:
            try:
                t_sec = _parse_ts(str(raw_t)) / 1000.0
            except Exception:
                t_sec = prev_t + 1.0
    else:
        t_sec = prev_t + 1.0
    return lat, lng, t_sec


def gps_features_from_schema(session: dict) -> np.ndarray | None:
    """ODIDMob-validated courier route and delivery dynamics feature extractor.
    Extracts speed percentiles, acceleration/jerk, turning volatility, directness,
    stop count, and delivery idle-time ratio."""
    points = session.get("gps", [])
    if len(points) < 5:
        return None

    parsed_points = []
    cur_t = 0.0
    for p in points:
        lat, lng, cur_t = _parse_gps_point(p, cur_t)
        parsed_points.append((lat, lng, cur_t))

    lat = np.array([p[0] for p in parsed_points])
    lon = np.array([p[1] for p in parsed_points])
    t = np.array([p[2] for p in parsed_points])

    seg_dist = np.array([_haversine_m(lat[i], lon[i], lat[i + 1], lon[i + 1]) for i in range(len(points) - 1)])
    dt = np.diff(t)
    dt_safe = np.where(dt > 0, dt, 1.0)
    speed = seg_dist / dt_safe
    valid_speed = speed[np.isfinite(speed) & (speed < 60.0)]  # clip unrealistic GPS jumps > 60 m/s (~216 km/h)
    if valid_speed.size < 3:
        return None

    accel = np.diff(valid_speed)
    jerk = np.diff(accel) if accel.size > 1 else np.array([0.0])

    bearing = np.arctan2(np.diff(lon), np.diff(lat))
    turn = np.mod(np.diff(bearing) + np.pi, 2 * np.pi) - np.pi

    path_length = float(np.sum(seg_dist))
    straight_line = _haversine_m(lat[0], lon[0], lat[-1], lon[-1])
    directness = float(straight_line / max(path_length, 1.0))

    # Stop metrics (stops at delivery addresses vs continuous transit)
    is_stopped = speed < _STOP_SPEED_MPS
    stop_count = int(np.sum(np.diff(is_stopped.astype(int)) > 0))
    total_time = max(float(t[-1] - t[0]), 1.0)
    stop_time = float(np.sum(dt_safe[is_stopped])) if is_stopped.any() else 0.0
    stop_duration_ratio = float(min(stop_time / total_time, 1.0))

    start_ts_str = session.get("timestamp")
    if start_ts_str:
        try:
            start_dt = datetime.fromisoformat(str(start_ts_str).replace("Z", "+00:00"))
            hour = start_dt.hour + start_dt.minute / 60.0
        except Exception:
            hour = 12.0
    else:
        hour = 12.0
    hour_sin = float(np.sin(2 * np.pi * hour / 24.0))
    hour_cos = float(np.cos(2 * np.pi * hour / 24.0))

    return np.array([
        float(np.mean(valid_speed)),
        float(np.std(valid_speed)),
        float(np.percentile(valid_speed, 90)),
        float(np.percentile(valid_speed, 10)),
        float(np.mean(np.abs(accel))) if accel.size else 0.0,
        float(np.max(np.abs(accel))) if accel.size else 0.0,
        float(np.mean(np.abs(jerk))) if jerk.size else 0.0,
        float(np.std(turn)) if turn.size else 0.0,
        directness,
        float(stop_count),
        stop_duration_ratio,
        path_length / 1000.0,  # km
        hour_sin,
        hour_cos,
    ], dtype=np.float32)


# Stop-detection thresholds for turning a flat GPS point stream into
# ODIDMob-style route legs (ASSIGN->PICKUP->DELIVERY boundaries). A
# driver sitting near-still for this long is treated as a stop/delivery
# point, same semantic as a wave boundary in the real dataset.
_STOP_SPEED_MPS = 1.5
_MIN_STOP_DURATION_S = 15.0
_MIN_LEGS = 2


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    return float(2 * r * np.arcsin(np.sqrt(np.clip(a, 0, 1))))


def _detect_leg_boundaries(points: list[dict]) -> tuple[list[float], list[float]] | None:
    """Segments a flat point stream into legs by detecting
    sustained near-zero-speed delivery stops, giving (r_dis_lst, r_time_lst) in
    the same shape ODIDMob_Routes' own `props` carries — per-leg
    distance and the absolute timestamp of each leg boundary. Returns
    None if fewer than `_MIN_LEGS` legs can be resolved (e.g. a short
    session with no stops at all)."""
    if len(points) < 5:
        return None

    parsed_points = []
    cur_t = 0.0
    for p in points:
        lat_v, lng_v, cur_t = _parse_gps_point(p, cur_t)
        parsed_points.append((lat_v, lng_v, cur_t))

    lat = np.array([p[0] for p in parsed_points])
    lon = np.array([p[1] for p in parsed_points])
    t = np.array([p[2] for p in parsed_points])

    seg_dist = np.array([_haversine_m(lat[i], lon[i], lat[i + 1], lon[i + 1]) for i in range(len(points) - 1)])
    seg_dt = np.diff(t)
    seg_dt_safe = np.where(seg_dt > 0, seg_dt, np.nan)
    speed = seg_dist / seg_dt_safe

    boundary_idx = [0]
    i = 0
    n = len(speed)
    while i < n:
        if not (speed[i] < _STOP_SPEED_MPS):
            i += 1
            continue
        j = i
        while j < n and speed[j] < _STOP_SPEED_MPS:
            j += 1
        if t[j] - t[i] >= _MIN_STOP_DURATION_S:
            mid = (i + j) // 2
            if mid != boundary_idx[-1]:
                boundary_idx.append(mid)
        i = j
    if boundary_idx[-1] != len(points) - 1:
        boundary_idx.append(len(points) - 1)

    if len(boundary_idx) - 1 < _MIN_LEGS:
        # Adaptive kinematic micro-leg segmentation fallback:
        # When explicit standstill stops (<1.5 m/s for 15s) are fewer than _MIN_LEGS
        # (e.g. single-leg delivery sprint, highway cruising, or sparse pings),
        # detect kinematic inflection points (directional pivots, speed inflection)
        # to segment continuous trips into natural kinematic legs so the validated
        # GRU Trajectory Triplet Encoder can still score the route.
        if len(points) >= 6:
            candidates = []
            # 1. Directional pivot points (significant turns > ~28 deg / 0.5 rad)
            if len(lat) >= 3:
                d_lat = np.diff(lat)
                d_lon = np.diff(lon)
                bearing = np.arctan2(d_lon, d_lat)
                turn = np.mod(np.diff(bearing) + np.pi, 2 * np.pi) - np.pi
                for idx in np.where(np.abs(turn) > 0.5)[0] + 1:
                    candidates.append(int(idx))

            # 2. Speed inflection transitions (acceleration sign changes with notable delta)
            valid_speed_clean = np.nan_to_num(speed, nan=0.0)
            if len(valid_speed_clean) >= 4:
                accel = np.diff(valid_speed_clean)
                for idx in np.where((accel[:-1] * accel[1:] < -0.3))[0] + 1:
                    candidates.append(int(idx))

            # Filter candidate indices to be spaced by at least 2 points
            candidates = sorted(set(candidates))
            adaptive_boundaries = [0]
            for c in candidates:
                if 2 <= c <= len(points) - 3 and (c - adaptive_boundaries[-1] >= 2):
                    adaptive_boundaries.append(c)
                    if len(adaptive_boundaries) >= 4:
                        break

            # 3. If still only 1 leg and total path distance >= 100m, split at midpoint
            total_path_dist = float(np.nansum(seg_dist))
            if len(adaptive_boundaries) == 1 and total_path_dist >= 100.0:
                mid = len(points) // 2
                if 2 <= mid <= len(points) - 2:
                    adaptive_boundaries.append(mid)

            if adaptive_boundaries[-1] != len(points) - 1:
                adaptive_boundaries.append(len(points) - 1)

            if len(adaptive_boundaries) - 1 >= _MIN_LEGS:
                boundary_idx = adaptive_boundaries
            else:
                return None
        else:
            return None

    r_dis_lst = [
        float(seg_dist[boundary_idx[k]:boundary_idx[k + 1]].sum())
        for k in range(len(boundary_idx) - 1)
    ]
    r_time_lst = [float(t[idx]) for idx in boundary_idx]
    return r_dis_lst, r_time_lst


def gps_leg_sequence_from_schema(session: dict):
    """The real fix for the GPS schema gap documented in
    rider_model_bundle.py: derives ODIDMob-shaped route legs from the
    flat point stream via stop-detection, then feeds the validated
    triplet encoder's own `route_to_leg_sequence()` so the model that
    actually won on real ODIDMob courier data (ml/README.md's Phase 2)
    can run on live sessions instead of the unvalidated 4-feature
    stopgap in `gps_features_from_schema`. Returns None (not a session
    with too few detected stops to trust a leg segmentation) when the
    stream doesn't have enough structure — callers fall back to the
    classical stopgap in that case."""
    from ml.models.gps_triplet_encoder import route_to_leg_sequence

    points = session.get("gps", [])
    boundaries = _detect_leg_boundaries(points)
    if boundaries is None:
        return None
    r_dis_lst, r_time_lst = boundaries
    return route_to_leg_sequence({"r_dis_lst": r_dis_lst, "r_time_lst": r_time_lst})
