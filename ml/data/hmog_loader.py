"""Loader for the H-MOG dataset (Yang et al., SenSys'14), extracted from
the per-user zips in data/hmog/*.zip. Column layout taken from H-MOG's
own data_description.pdf (no header row in the CSVs):

Accelerometer.csv: Systime, EventTime, ActivityID, X, Y, Z, Phone_orientation
TouchEvent.csv:    Systime, EventTime, ActivityID, Pointer_count, PointerID,
                    ActionID, X, Y, Pressure, Contact_size, Phone_orientation
                    (ActionID 0 or 5 = DOWN, 1 or 6 = UP, 2 = MOVE)
"""
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

HMOG_ROOT = Path(__file__).resolve().parents[2] / "data" / "hmog"
EXTRACT_ROOT = HMOG_ROOT / "extracted"


def list_users() -> list[str]:
    return sorted(p.stem for p in HMOG_ROOT.glob("*.zip"))


def ensure_extracted(user_id: str) -> Path:
    """Extracts data/hmog/<user_id>.zip into data/hmog/extracted/<user_id>/
    the first time it's needed; reuses it after that. The zip's own
    top-level folder is already named after the user, so extracting into
    EXTRACT_ROOT directly lands sessions at EXTRACT_ROOT/<user_id>/<user_id>_session_N —
    no extra nesting needed."""
    user_dir = EXTRACT_ROOT / user_id
    if not user_dir.exists():
        EXTRACT_ROOT.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(HMOG_ROOT / f"{user_id}.zip") as zf:
            zf.extractall(EXTRACT_ROOT)
    return user_dir


def session_dirs(user_id: str) -> list[Path]:
    """Sorted numerically by session number (session_2 before
    session_10) — lexical sort would put session_10, session_11 before
    session_2, which quietly breaks any chronological-order assumption
    (H-MOG session numbers are assigned in collection order)."""
    root = ensure_extracted(user_id)
    dirs = list(root.glob(f"{user_id}_session_*"))
    return sorted(dirs, key=lambda p: int(p.name.rsplit("_", 1)[-1]))


def read_hmog_csv(path: Path, n_cols: int) -> np.ndarray:
    """A small fraction of H-MOG's raw CSV rows are malformed (truncated
    writes during collection — e.g. a row with 3 fields instead of 11).
    `np.genfromtxt` raises on the first such row and kills the whole
    load; pandas with `on_bad_lines='skip'` drops only the bad rows and
    keeps the rest, which is what we want here."""
    if not path.exists() or path.stat().st_size == 0:
        return np.empty((0, n_cols))
    df = pd.read_csv(path, header=None, delimiter=",", on_bad_lines="skip", engine="python")
    if df.shape[1] != n_cols:
        return np.empty((0, n_cols))
    return df.to_numpy(dtype=float)


def motion_features(session_dir: Path) -> np.ndarray | None:
    """Mean accelerometer vector for a session — the OLD, simple feature
    convention (kept for ml/scripts/calibrate_sim_from_hmog.py and the
    original validate_motion_touch_on_hmog.py). The real Phase-1
    pipeline uses ml/features/motion_features.py's windowed features
    instead — see run_phase1_evaluation.py."""
    data = read_hmog_csv(session_dir / "Accelerometer.csv", n_cols=7)
    if data.size == 0 or data.ndim != 2 or data.shape[0] < 10:
        return None
    x, y, z = data[:, 3], data[:, 4], data[:, 5]
    return np.array([float(np.mean(x)), float(np.mean(y)), float(np.mean(z))])


def touch_features(session_dir: Path) -> np.ndarray | None:
    """Tap pressure mean/std, contact-size mean, and inter-tap interval
    mean from DOWN touch events — the OLD, simple feature convention
    (kept for backward compat). The real Phase-1 pipeline uses
    ml/features/touch_features.py's per-stroke features instead."""
    data = read_hmog_csv(session_dir / "TouchEvent.csv", n_cols=11)
    if data.size == 0 or data.ndim != 2 or data.shape[0] < 5:
        return None
    action_id = data[:, 5]
    downs = data[np.isin(action_id, [0, 5])]
    if downs.shape[0] < 3:
        return None
    pressure = downs[:, 8]
    contact = downs[:, 9]
    systime = downs[:, 0]
    intervals = np.diff(np.sort(systime))
    return np.array([
        float(np.mean(pressure)),
        float(np.std(pressure)) if pressure.size > 1 else 0.0,
        float(np.mean(contact)),
        float(np.mean(intervals)) if intervals.size else 0.0,
    ])
