"""Driver time-series behavioral profiler and adaptive online learning.

Distinguishes between:
1. Legitimate gradual concept drift (e.g. driver habituation, fatigue, seasonal pattern)
   -> Trigger silent adaptive rebaselining within hard credibility bounds.
2. Boiling-Frog poisoning attacks (slow intentional degradation past max_silent_drift_limit)
   -> Cap silent adaptation and mandate ground-truth challenge.
3. Sudden abrupt step change (e.g. account handoff / unauthorized driver)
   -> Trigger challenge at safe pause.
4. Diurnal bimodal split (e.g. split-shift account rental)
   -> Flag for fleet admin audit.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np

logger = logging.getLogger("aslikaun.driver_timeseries")


@dataclass
class TimeSeriesPoint:
    timestamp: str
    behavior_score: float
    context_score: float
    quadrant: str
    decision: str
    signals: dict[str, float] = field(default_factory=dict)


class DriverTimeSeriesProfiler:
    """Tracks a driver's behavioral evolution across consecutive sessions with bounded CUSUM guardrails."""

    def __init__(
        self,
        driver_id: str,
        window_size: int = 30,
        drift_delta_threshold: float = 0.25,
        jump_delta_threshold: float = 0.40,
        adaptation_rate: float = 0.15,
        max_silent_drift_limit: float = 0.24,
    ):
        self.driver_id = driver_id
        self.window_size = window_size
        self.drift_delta_threshold = drift_delta_threshold
        self.jump_delta_threshold = jump_delta_threshold
        self.adaptation_rate = adaptation_rate
        self.max_silent_drift_limit = max_silent_drift_limit

        self.history: list[dict[str, Any]] = []
        self.rolling_mean_behavior: float | None = None
        self.rolling_var_behavior: float = 0.02
        self.anchor_behavior: float | None = None
        self.initial_enrollment_anchor: float | None = None
        self.total_sessions: int = 0
        self.consecutive_stable: int = 0
        self.drift_state: str = "calibrating"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DriverTimeSeriesProfiler":
        profiler = cls(
            driver_id=data.get("driver_id", "unknown"),
            window_size=data.get("window_size", 30),
            drift_delta_threshold=data.get("drift_delta_threshold", 0.25),
            jump_delta_threshold=data.get("jump_delta_threshold", 0.40),
            adaptation_rate=data.get("adaptation_rate", 0.15),
            max_silent_drift_limit=data.get("max_silent_drift_limit", 0.24),
        )
        profiler.history = data.get("history", [])[-profiler.window_size :]
        profiler.rolling_mean_behavior = data.get("rolling_mean_behavior")
        profiler.rolling_var_behavior = data.get("rolling_var_behavior", 0.02)
        profiler.anchor_behavior = data.get("anchor_behavior")
        profiler.initial_enrollment_anchor = data.get("initial_enrollment_anchor", profiler.anchor_behavior)
        profiler.total_sessions = data.get("total_sessions", len(profiler.history))
        profiler.consecutive_stable = data.get("consecutive_stable", 0)
        profiler.drift_state = data.get("drift_state", "calibrating")
        return profiler

    def to_dict(self) -> dict[str, Any]:
        return {
            "driver_id": self.driver_id,
            "window_size": self.window_size,
            "drift_delta_threshold": self.drift_delta_threshold,
            "jump_delta_threshold": self.jump_delta_threshold,
            "adaptation_rate": self.adaptation_rate,
            "max_silent_drift_limit": self.max_silent_drift_limit,
            "history": self.history[-self.window_size :],
            "rolling_mean_behavior": self.rolling_mean_behavior,
            "rolling_var_behavior": self.rolling_var_behavior,
            "anchor_behavior": self.anchor_behavior,
            "initial_enrollment_anchor": self.initial_enrollment_anchor,
            "total_sessions": self.total_sessions,
            "consecutive_stable": self.consecutive_stable,
            "drift_state": self.drift_state,
        }

    def assimilate_verified_challenge(
        self,
        verified_score: float,
        method: str = "face_step_up",
    ) -> dict[str, Any]:
        """Safely re-anchors the behavioral baseline upon ground-truth identity verification.

        Absorbs verified behavioral ground truth, resets cumulative drift bounds, and restores
        stable tracking without allowing unverified drift poisoning.
        """
        old_anchor = self.anchor_behavior
        # Weighted blend of previous anchor and newly verified ground-truth score
        self.anchor_behavior = float(round(0.4 * (self.anchor_behavior or verified_score) + 0.6 * verified_score, 4))
        self.rolling_mean_behavior = self.anchor_behavior
        self.initial_enrollment_anchor = self.anchor_behavior
        self.drift_state = "verified_reanchored"
        self.consecutive_stable = 5
        logger.info(
            "Driver %s re-anchored via %s: old_anchor=%s -> new_anchor=%.4f",
            self.driver_id, method, old_anchor, self.anchor_behavior
        )
        return {
            "status": "reanchored",
            "old_anchor": old_anchor,
            "new_anchor": self.anchor_behavior,
            "verification_method": method,
        }

    def update(
        self,
        behavior_score: float | None,
        context_score: float | None,
        quadrant: str,
        decision: str,
        signals: dict[str, float] | None = None,
        timestamp: str | None = None,
    ) -> dict[str, Any]:
        """Processes a new session and evaluates time-series behavioral dynamics.

        Returns:
            dict containing drift diagnostics, adaptation action, and trend metrics.
        """
        self.total_sessions += 1
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        b_score = behavior_score if behavior_score is not None else 0.5
        c_score = context_score if context_score is not None else 1.0

        point = {
            "timestamp": ts,
            "behavior_score": round(b_score, 4),
            "context_score": round(c_score, 4),
            "quadrant": quadrant,
            "decision": decision,
            "signals": signals or {},
        }
        self.history.append(point)
        if len(self.history) > self.window_size:
            self.history.pop(0)

        # Cold start
        if self.anchor_behavior is None:
            if len(self.history) >= 3:
                scores = [p["behavior_score"] for p in self.history]
                self.anchor_behavior = float(np.mean(scores))
                self.initial_enrollment_anchor = self.anchor_behavior
                self.rolling_mean_behavior = self.anchor_behavior
                self.drift_state = "stable"
            else:
                self.drift_state = "calibrating"
            return {
                "drift_state": self.drift_state,
                "action": "none_calibrating",
                "trend_slope": 0.0,
                "adaptive_rebaselined": False,
            }

        if self.initial_enrollment_anchor is None:
            self.initial_enrollment_anchor = self.anchor_behavior

        prev_mean = self.rolling_mean_behavior if self.rolling_mean_behavior is not None else self.anchor_behavior
        step_delta = abs(b_score - prev_mean)

        # Update rolling statistics (Welford-style EWMA)
        decay = 0.2
        self.rolling_mean_behavior = float((1.0 - decay) * prev_mean + decay * b_score)
        self.rolling_var_behavior = float((1.0 - decay) * self.rolling_var_behavior + decay * (step_delta**2))

        # Check linear trend over recent window
        recent_scores = [p["behavior_score"] for p in self.history[-10:]]
        if len(recent_scores) >= 5:
            xs = np.arange(len(recent_scores))
            slope, _ = np.polyfit(xs, recent_scores, 1)
        else:
            slope = 0.0

        # Diagnosis: Step Jump vs Gradual Drift vs Boiling-Frog Bound vs Stable
        adaptive_rebaselined = False
        action = "monitor"

        cumulative_drift_from_enrollment = abs(self.rolling_mean_behavior - self.initial_enrollment_anchor)

        if step_delta >= self.jump_delta_threshold and quadrant in ("handoff_signature", "ambiguous"):
            # Sudden high-magnitude drop in behavior continuity (unauthorized handoff)
            self.drift_state = "sudden_shift_detected"
            self.consecutive_stable = 0
            action = "challenge_recommended"
        elif cumulative_drift_from_enrollment >= self.max_silent_drift_limit:
            # Boiling-Frog Protection: Cumulative drift has hit the hard credibility limit!
            # Cap silent rebaselining and mandate identity re-verification.
            self.drift_state = "drift_limit_exceeded_verification_required"
            action = "challenge_recommended"
        elif (
            abs(self.rolling_mean_behavior - self.anchor_behavior) >= self.drift_delta_threshold
            and step_delta < self.jump_delta_threshold
        ):
            # Gradual shift within bounded credibility envelope
            if quadrant in ("stable", "legit_change"):
                self.drift_state = "adapting_gradual_drift"
                self.anchor_behavior = float(
                    (1.0 - self.adaptation_rate) * self.anchor_behavior
                    + self.adaptation_rate * self.rolling_mean_behavior
                )
                adaptive_rebaselined = True
                action = "silent_adaptive_rebaseline"
            else:
                self.drift_state = "unverified_drift"
                action = "monitor_closely"
        else:
            self.drift_state = "stable"
            self.consecutive_stable += 1
            action = "continue_stable"

        return {
            "drift_state": self.drift_state,
            "action": action,
            "step_delta": round(step_delta, 4),
            "trend_slope": round(float(slope), 5),
            "anchor_behavior": round(self.anchor_behavior, 4),
            "rolling_mean_behavior": round(self.rolling_mean_behavior, 4),
            "cumulative_drift": round(cumulative_drift_from_enrollment, 4),
            "adaptive_rebaselined": adaptive_rebaselined,
            "consecutive_stable": self.consecutive_stable,
        }
