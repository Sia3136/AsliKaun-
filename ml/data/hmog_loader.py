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
    root = ensure_extracted(user_id)
    return sorted(root.glob(f"{user_id}_session_*"))


def _read_csv(path: Path) -> np.ndarray:
    if not path.exists() or path.stat().st_size == 0:
        return np.empty((0, 0))
    return np.genfromtxt(path, delimiter=",")


def motion_features(session_dir: Path) -> np.ndarray | None:
    """Mean accelerometer vector for a session — same feature convention
    as ml/scorers/motion.py's synthetic version, so the two are directly
    comparable."""
    data = _read_csv(session_dir / "Accelerometer.csv")
    if data.size == 0 or data.ndim != 2 or data.shape[0] < 10:
        return None
    x, y, z = data[:, 3], data[:, 4], data[:, 5]
    return np.array([float(np.mean(x)), float(np.mean(y)), float(np.mean(z))])


def touch_features(session_dir: Path) -> np.ndarray | None:
    """Tap pressure mean/std, contact-size mean, and inter-tap interval
    mean from DOWN touch events — same convention as ml/scorers/touch.py."""
    data = _read_csv(session_dir / "TouchEvent.csv")
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
