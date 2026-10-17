"""Synthetic rider session generator matching the frozen session schema.

Generates a per-rider behavioral persona, then samples honest sessions around
it and "handoff" sessions that swap in a second persona's operational and
motion signature on the same device/zone/network (the same-phone-different-
person case). No external dataset is needed for this scorer.
"""
import numpy as np

SCHEMA_VERSION = "1.0"

ZONES = ["andheri", "bandra", "dadar", "powai", "thane", "navi_mumbai"]


def make_profile(rider_id: str, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    home_zone = rng.choice(ZONES)
    n_zones = rng.integers(1, 3)
    other_zones = rng.choice([z for z in ZONES if z != home_zone], size=n_zones - 1, replace=False)
    return {
        "rider_id": rider_id,
        "device_id": f"dev-{rider_id}",
        "ip_subnet": f"10.{rng.integers(0, 255)}.{rng.integers(0, 255)}.0/24",
        "zones": [home_zone, *other_zones],
        "preferred_hour": rng.uniform(7, 21),
        "hour_spread": rng.uniform(1.5, 4.0),
        "accept_latency_mean_ms": rng.uniform(800, 4000),
        "accept_latency_std_ms": rng.uniform(100, 500),
        # accel_signature / accel_noise spread calibrated against real H-MOG
        # inter- and intra-person accelerometer variance (see
        # ml/scripts/calibrate_sim_from_hmog.py, run on 24 real users):
        # between-person std ~0.84/axis, within-person std ~0.73-1.37/axis.
        # Note within-person noise is comparable to (and can exceed)
        # between-person spread in real data — raw mean-accel-vector is a
        # genuinely modest signal alone, which is WHY the architecture
        # combines motion with operational/touch/GPS rather than relying
        # on any one signal (see ml/README.md's H-MOG validation results).
        "accel_signature": rng.normal(0, 0.843, size=3),
        "accel_noise": rng.uniform(0.735, 1.365),
        "touch_pressure_mean": rng.uniform(0.3, 0.8),
        "touch_pressure_std": rng.uniform(0.05, 0.15),
        "tap_interval_ms_mean": rng.uniform(150, 400),
    }


_BLEND_KEYS = [
    "accept_latency_mean_ms", "accept_latency_std_ms", "accel_signature",
    "accel_noise", "touch_pressure_mean", "touch_pressure_std", "tap_interval_ms_mean",
]


def blend_profiles(a: dict, b: dict, alpha: float) -> dict:
    """A behavior-only profile that linearly interpolates a's and b's
    numeric traits: alpha=0 -> a's behavior, alpha=1 -> b's behavior.
    Used for the slow-drift-renter red-team scenario, where a handoff
    doesn't happen all at once. Pass the result as `impersonator` to
    generate_session — it only reads these behavior keys."""
    return {k: (1 - alpha) * np.asarray(a[k]) + alpha * np.asarray(b[k]) for k in _BLEND_KEYS}


def _sample_touch_events(profile: dict, rng: np.random.Generator, n: int = 5) -> list:
    events = []
    t = 0.0
    for _ in range(n):
        t += rng.normal(profile["tap_interval_ms_mean"], 40)
        events.append({
            "type": "tap",
            "pressure": float(np.clip(rng.normal(profile["touch_pressure_mean"], profile["touch_pressure_std"]), 0, 1)),
            "area": float(np.clip(rng.normal(0.5, 0.1), 0, 1)),
            "duration_ms": float(max(30, rng.normal(90, 20))),
            "t_offset_ms": float(t),
        })
    return events


def generate_session(
    profile: dict,
    timestamp,
    seed: int,
    impersonator: dict | None = None,
    context_override: dict | None = None,
) -> dict:
    """One session.

    - `impersonator`: another rider's profile. Device/IP/zone stay the
      owner's, but operational/motion/touch behavior comes from the
      impersonator — the same-phone-different-person handoff case.
    - `context_override`: dict with any of device_id/ip_subnet/zone, to
      simulate a legit context change (new phone, moved city) while
      behavior stays the profile owner's own.
    """
    rng = np.random.default_rng(seed)
    behavior_source = impersonator if impersonator is not None else profile
    context_override = context_override or {}

    hour = timestamp.hour + timestamp.minute / 60
    accept_latency_ms = float(max(200, rng.normal(
        behavior_source["accept_latency_mean_ms"], behavior_source["accept_latency_std_ms"])))
    accel = (behavior_source["accel_signature"] + rng.normal(0, behavior_source["accel_noise"], size=3)).tolist()
    touch_events = _sample_touch_events(behavior_source, rng)

    return {
        "driver_id": profile["rider_id"],
        "session_id": f"{profile['rider_id']}-{int(timestamp.timestamp())}",
        "timestamp": timestamp.isoformat(),
        "device_id": context_override.get("device_id", profile["device_id"]),
        "ip_subnet": context_override.get("ip_subnet", profile["ip_subnet"]),
        "zone": context_override.get("zone", profile["zones"][0]),
        "accel": [{"x": accel[0], "y": accel[1], "z": accel[2], "t": timestamp.isoformat()}],
        "gyro": [],
        "touch_events": touch_events,
        "accept_latency_ms": accept_latency_ms,
        "hour_of_day": hour,
        "is_handoff": impersonator is not None,
    }
