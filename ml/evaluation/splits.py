"""Chronological per-rider splits. Never shuffle before splitting — a
random split would let a model trained on "future" sessions evaluate on
"past" ones, which can't happen in a real deployment and inflates
reported performance.
"""


def chronological_split(sessions: list, enroll_frac: float = 0.6, calib_frac: float = 0.2):
    """sessions must already be time-ordered (oldest first). Returns
    (enroll, calib, test) — test is whatever's left after enroll+calib,
    i.e. the most recent ~20% by default."""
    n = len(sessions)
    n_enroll = int(n * enroll_frac)
    n_calib = int(n * calib_frac)
    enroll = sessions[:n_enroll]
    calib = sessions[n_enroll:n_enroll + n_calib]
    test = sessions[n_enroll + n_calib:]
    return enroll, calib, test
