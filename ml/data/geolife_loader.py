"""Loader for the Microsoft GeoLife GPS Trajectories dataset.

Each user is a folder `Data/<uid>/Trajectory/*.plt`. A .plt file has a
6-line header then rows: lat, lon, 0, altitude_ft, days_since_epoch,
date, time. This dataset is NOT rider-specific delivery data — it's used
here as a public source of real multi-person GPS behavior to validate
that movement-derived features actually separate people, the same role
H-MOG plays for touch/motion (see ml/README.md).
"""
from datetime import datetime
from pathlib import Path

import numpy as np

GEOLIFE_ROOT = Path(__file__).resolve().parents[2] / "data" / "geolife" / "Geolife Trajectories 1.3" / "Data"


def list_users() -> list[str]:
    return sorted(p.name for p in GEOLIFE_ROOT.iterdir() if p.is_dir())


def load_trajectory(plt_path: Path) -> np.ndarray:
    """Returns an (N, 3) array of [lat, lon, unix_seconds]."""
    rows = []
    with open(plt_path, "r") as f:
        lines = f.readlines()[6:]
    for line in lines:
        parts = line.strip().split(",")
        if len(parts) < 7:
            continue
        lat, lon = float(parts[0]), float(parts[1])
        date, time = parts[5], parts[6]
        ts = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S").timestamp()
        rows.append((lat, lon, ts))
    return np.array(rows)


def load_user_trajectories(user_id: str, limit: int | None = None) -> list[np.ndarray]:
    traj_dir = GEOLIFE_ROOT / user_id / "Trajectory"
    files = sorted(traj_dir.glob("*.plt"))
    if limit:
        files = files[:limit]
    return [load_trajectory(f) for f in files]


def haversine_m(lat1, lon1, lat2, lon2) -> np.ndarray:
    """Vectorized great-circle distance in meters."""
    r = 6371000.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def trajectory_features(traj: np.ndarray) -> np.ndarray | None:
    """Speed and turn-rate summary stats for one trajectory. Returns None
    for degenerate trajectories (too short, or zero-duration points)."""
    if traj.shape[0] < 5:
        return None
    lat, lon, t = traj[:, 0], traj[:, 1], traj[:, 2]
    dt = np.diff(t)
    dt[dt == 0] = np.nan
    dist = haversine_m(lat[:-1], lon[:-1], lat[1:], lon[1:])
    speed = dist / dt  # m/s
    speed = speed[np.isfinite(speed) & (speed < 50)]  # drop GPS glitches (>180 km/h)
    if speed.size < 3:
        return None
    accel = np.diff(speed)
    bearing = np.arctan2(np.diff(lon), np.diff(lat))
    turn = np.diff(bearing)
    turn = np.mod(turn + np.pi, 2 * np.pi) - np.pi  # wrap to [-pi, pi]
    return np.array([
        float(np.mean(speed)),
        float(np.std(speed)),
        float(np.mean(np.abs(accel))) if accel.size else 0.0,
        float(np.std(turn)) if turn.size else 0.0,
    ])
