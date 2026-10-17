"""Stroke-level touch features from H-MOG's TouchEvent.csv, aggregated
into a session-level distributional summary (not just session means —
percentiles capture the shape of the rider's gesture distribution, not
just its center).

TouchEvent.csv columns (no header row, from H-MOG's data_description.pdf):
Systime, EventTime, ActivityID, Pointer_count, PointerID, ActionID, X, Y,
Pressure, Contact_size, Phone_orientation. ActionID: 0/5=DOWN, 1/6=UP, 2=MOVE.
"""
import numpy as np

COL_SYSTIME, COL_POINTER_ID, COL_ACTION, COL_X, COL_Y, COL_PRESSURE, COL_SIZE = 0, 4, 5, 6, 7, 8, 9

STROKE_FEATURE_NAMES = [
    "duration_ms", "path_length_px", "velocity_mean", "velocity_peak",
    "accel_mean_abs", "direction_rad", "curvature_std",
    "pressure_mean", "pressure_var", "pressure_slope", "area_mean",
]

_AGG_STATS = ["mean", "std", "p10", "p50", "p90"]
SESSION_FEATURE_NAMES = (
    [f"{feat}_{stat}" for feat in STROKE_FEATURE_NAMES for stat in _AGG_STATS]
    + ["frac_swipe", "stroke_rate_per_min", "inter_stroke_interval_mean", "inter_stroke_interval_std"]
)

_SWIPE_PATH_LENGTH_PX = 40.0  # path longer than this = swipe, else tap


def extract_strokes(touch_data: np.ndarray) -> list[np.ndarray]:
    """Groups single-touch (PointerID==0) events into strokes between a
    DOWN and its matching UP, returns one feature vector per stroke."""
    if touch_data.size == 0 or touch_data.ndim != 2:
        return []
    single = touch_data[touch_data[:, COL_POINTER_ID] == 0]
    single = single[np.argsort(single[:, COL_SYSTIME])]

    strokes = []
    buf = []
    for row in single:
        action = row[COL_ACTION]
        if action in (0, 5):
            buf = [row]
        elif action == 2 and buf:
            buf.append(row)
        elif action in (1, 6) and buf:
            buf.append(row)
            strokes.append(np.array(buf))
            buf = []
    return [f for f in (_stroke_features(s) for s in strokes) if f is not None]


def _stroke_features(stroke: np.ndarray) -> np.ndarray | None:
    if stroke.shape[0] < 2:
        return None
    t = stroke[:, COL_SYSTIME]
    x, y = stroke[:, COL_X], stroke[:, COL_Y]
    pressure = stroke[:, COL_PRESSURE]
    area = stroke[:, COL_SIZE]

    duration = float(t[-1] - t[0])
    if duration <= 0:
        return None

    dx, dy = np.diff(x), np.diff(y)
    dt = np.diff(t)
    dt[dt == 0] = np.nan
    seg_len = np.sqrt(dx ** 2 + dy ** 2)
    path_length = float(np.nansum(seg_len))
    velocities = seg_len / dt
    velocities = velocities[np.isfinite(velocities)]
    velocity_mean = float(np.mean(velocities)) if velocities.size else 0.0
    velocity_peak = float(np.max(velocities)) if velocities.size else 0.0
    accel = np.diff(velocities)
    accel_mean_abs = float(np.mean(np.abs(accel))) if accel.size else 0.0

    direction = float(np.arctan2(y[-1] - y[0], x[-1] - x[0]))
    if len(x) >= 3:
        headings = np.arctan2(dy, dx)
        turn = np.diff(headings)
        turn = np.mod(turn + np.pi, 2 * np.pi) - np.pi
        curvature_std = float(np.std(turn))
    else:
        curvature_std = 0.0

    pressure_mean = float(np.mean(pressure))
    pressure_var = float(np.var(pressure))
    if len(pressure) >= 2:
        t_norm = (t - t[0]) / duration
        pressure_slope = float(np.polyfit(t_norm, pressure, 1)[0])
    else:
        pressure_slope = 0.0
    area_mean = float(np.mean(area))

    return np.array([
        duration, path_length, velocity_mean, velocity_peak, accel_mean_abs,
        direction, curvature_std, pressure_mean, pressure_var, pressure_slope, area_mean,
    ])


def _stats(values: np.ndarray) -> list[float]:
    if values.size == 0:
        return [0.0] * len(_AGG_STATS)
    return [
        float(np.mean(values)), float(np.std(values)),
        float(np.percentile(values, 10)), float(np.percentile(values, 50)), float(np.percentile(values, 90)),
    ]


def session_touch_features(touch_data: np.ndarray, min_strokes: int = 3) -> np.ndarray | None:
    """The real per-session feature vector: distributional summary over
    all strokes in the session, not a single session-wide average."""
    stroke_vecs = extract_strokes(touch_data)
    if len(stroke_vecs) < min_strokes:
        return None
    S = np.stack(stroke_vecs)  # (n_strokes, len(STROKE_FEATURE_NAMES))

    agg = []
    for col in range(S.shape[1]):
        agg.extend(_stats(S[:, col]))

    path_lengths = S[:, STROKE_FEATURE_NAMES.index("path_length_px")]
    frac_swipe = float(np.mean(path_lengths > _SWIPE_PATH_LENGTH_PX))

    # inter-stroke interval needs stroke START systimes, not kept in stroke_vecs — recompute from raw data
    single = touch_data[touch_data[:, COL_POINTER_ID] == 0]
    single = single[np.argsort(single[:, COL_SYSTIME])]
    down_times = single[np.isin(single[:, COL_ACTION], [0, 5]), COL_SYSTIME]
    down_times = np.sort(down_times)
    if len(down_times) >= 2:
        intervals = np.diff(down_times)
        inter_mean, inter_std = float(np.mean(intervals)), float(np.std(intervals))
        duration_span = (down_times[-1] - down_times[0]) / 1000.0 / 60.0  # ms -> min
        stroke_rate = len(stroke_vecs) / duration_span if duration_span > 0 else 0.0
    else:
        inter_mean, inter_std, stroke_rate = 0.0, 0.0, 0.0

    agg.extend([frac_swipe, stroke_rate, inter_mean, inter_std])
    return np.array(agg)
