"""GPS/mobility anomaly scorer: speed, acceleration, and turn-rate
signature, fit per rider on that rider's own trajectory history.
"""
from ml.scorers.base import PrecomputedVectorScorer


class GPSScorer(PrecomputedVectorScorer):
    pass
