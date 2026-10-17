"""Per-delivery-wave GPS features from ODIDMob_Routes. Each wave is one
courier's multi-stop route (ASSIGN -> PICKUP -> DELIVERY -> ...), with
per-leg distances/timestamps already provided plus the full reconstructed
path geometry.
"""
from datetime import datetime, timezone

import numpy as np

FEATURE_NAMES = [
    "r_dis_all", "r_dur_all", "nav_dis", "nav_dur", "rider_spd",
    "no_act", "no_nav", "max_load", "rider_lvl",
    "leg_dist_mean", "leg_dist_std", "leg_dist_p90",
    "leg_dur_mean", "leg_dur_std", "leg_dur_p90",
    "leg_speed_mean", "leg_speed_std", "leg_speed_p90",
    "path_length", "heading_std", "directness",
    "hour_sin", "hour_cos",
]


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    return float(2 * r * np.arcsin(np.sqrt(np.clip(a, 0, 1))))


def _percentile(arr, p, default=0.0):
    return float(np.percentile(arr, p)) if len(arr) else default


def route_features(props: dict, coords: list) -> np.ndarray | None:
    """Returns a fixed-length feature vector (FEATURE_NAMES order) for one
    route, or None if the route is too degenerate to use (too few legs
    or points)."""
    r_dis_lst = props.get("r_dis_lst") or []
    r_time_lst = props.get("r_time_lst") or []
    if len(r_dis_lst) < 1 or len(r_time_lst) < 2 or len(coords) < 3:
        return None

    leg_dists = np.array(r_dis_lst, dtype=float)
    leg_durs = np.diff(np.array(r_time_lst, dtype=float))
    leg_durs = leg_durs[leg_durs > 0]
    n = min(len(leg_dists), len(leg_durs))
    if n == 0:
        return None
    leg_dists, leg_durs = leg_dists[:n], leg_durs[:n]
    leg_speeds = leg_dists / leg_durs

    # path length + heading-change stats from the reconstructed geometry
    pts = np.array(coords, dtype=float)  # [lon, lat] pairs
    seg_lens = np.array([
        _haversine_m(pts[i, 1], pts[i, 0], pts[i + 1, 1], pts[i + 1, 0])
        for i in range(len(pts) - 1)
    ])
    path_length = float(seg_lens.sum())
    if path_length < 1.0:
        return None

    headings = np.arctan2(np.diff(pts[:, 1]), np.diff(pts[:, 0]))
    turn = np.diff(headings)
    turn = np.mod(turn + np.pi, 2 * np.pi) - np.pi
    heading_std = float(np.std(turn)) if len(turn) else 0.0

    straight = _haversine_m(pts[0, 1], pts[0, 0], pts[-1, 1], pts[-1, 0])
    directness = straight / path_length

    start_dt = datetime.fromtimestamp(r_time_lst[0], tz=timezone.utc)
    hour = start_dt.hour + start_dt.minute / 60
    hour_sin, hour_cos = np.sin(2 * np.pi * hour / 24), np.cos(2 * np.pi * hour / 24)

    def g(key, default=0.0):
        v = props.get(key)
        return float(v) if v is not None else default

    return np.array([
        g("r_dis_all"), g("r_dur_all"), g("nav_dis"), g("nav_dur"), g("rider_spd"),
        g("no_act"), g("no_nav"), g("max_load"), g("rider_lvl"),
        float(np.mean(leg_dists)), float(np.std(leg_dists)), _percentile(leg_dists, 90),
        float(np.mean(leg_durs)), float(np.std(leg_durs)), _percentile(leg_durs, 90),
        float(np.mean(leg_speeds)), float(np.std(leg_speeds)), _percentile(leg_speeds, 90),
        path_length, heading_std, directness,
        hour_sin, hour_cos,
    ])
