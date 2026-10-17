# Trust Juggler — ML workstream

## Status

| Component | State |
| --- | --- |
| Session schema + synthetic rider simulator (`ml/sim/rider_sim.py`) | Done — honest, handoff, slow-drift, split-shift, copycat, long-absence, and cold-start session generators, calibrated to real H-MOG accel variance |
| Old mean-vector scorers (`ml/scorers/*.py`) | Superseded by Phase 1's real feature extractors + evaluation harness below, kept for the synthetic red-team/combiner tests which still use them |
| **Phase 1 real feature extractors** (`ml/features/*.py`) | Done — stroke-level touch, windowed (time+freq domain) motion, per-trip GPS, all validated to produce 100% valid vectors on real data |
| **ODIDMob_Routes dataset** (`ml/data/odidmob_loader.py`) | **Now usable** — real delivery-wave GeoJSON (828+ couriers in week 1 alone, median 20 waves/courier). Supersedes the earlier dead-end GitHub repo and GeoLife as the GPS source |
| H-MOG dataset (`ml/data/hmog_loader.py`) | Done — robust CSV reader (`read_hmog_csv`) skips the small fraction of malformed rows instead of crashing; session ordering bug fixed (was sorting session_10 before session_2) |
| **Classical baselines** (`ml/models/isolation_baseline.py`, `mahalanobis_baseline.py`) | Done, evaluated — see Phase 1 results below |
| **Conformal calibration + Fisher fusion** (`ml/calibration/`) | Done, tested — replaces the old `mean(anomaly_scores)` fusion with proper p-values and Fisher's method |
| **Rider-disjoint evaluation harness** (`ml/evaluation/`) | Done — chronological enroll/calibrate/test/impostor split, EER/AUC/FRR@FAR with bootstrap CIs |
| Two-axis combiner (`ml/combiner/two_axis.py`) | **Done — rewired to the new conformal+Fisher fusion** via `ml/combiner/signal_models.py`. Required recalibrating the behavior-axis threshold (0.6 -> 0.29, see below) and the red-team EWMA/frozen-anchor detector thresholds (noisier p-value scale) |
| Red-team simulator (`ml/redteam/`) | Done, re-verified against the new fusion — 8 scenarios: lazy/slow-drift/split-shift/copycat renters, honest phone+city change, honest illness, long-absence, cold-start |
| Reason-vector LLM call (`ml/llm/reason_vector.py`) | Done — Claude call only for escalated sessions, labeled template fallback otherwise |

## Phase 1 results: real EER/AUC, not "separates? yes/no"

Reduced-cohort pilot (stated explicitly, not the full dataset): 8 target riders x 10 impostors, chronological 60/20/20 enroll/calibrate/test split, real data throughout. Run: `python ml/scripts/run_phase1_evaluation.py`.

| Signal | Dataset | Model | Pooled EER | Pooled AUC | FRR@FAR=1% |
| --- | --- | --- | --- | --- | --- |
| GPS | ODIDMob_Routes (real Beijing delivery routes) | IsolationForest | 0.397 | 0.622 | 0.90 |
| GPS | ODIDMob_Routes | Mahalanobis | 0.431 | 0.590 | 0.94 |
| Touch | H-MOG (real) | IsolationForest | 0.408 | 0.624 | 0.81 |
| Touch | H-MOG | Mahalanobis | 0.569 | **0.454 (worse than chance)** | 0.79 |
| Motion | H-MOG (real) | IsolationForest | 0.440 | 0.570 | 0.94 |
| Motion | H-MOG | Mahalanobis | 0.456 | 0.567 | 0.83 |

**Honest read:** EER ~0.40-0.46 per signal alone is weak (0.5 = coin flip; real biometric systems target single digits). `FRR@FAR=1%` of 80-94% means none of these are usable standalone at a strict security threshold. **Mahalanobis fails outright on touch** (AUC < 0.5) — 59-dimensional features against ~15-20 enrollment sessions is too little data for a stable covariance estimate, even with shrinkage. **Decision: drop Mahalanobis for touch/motion going forward, keep IsolationForest.**

## The fusion check: does combining signals actually help?

Can't be tested on real data directly — no public dataset has operational+motion+touch simultaneously for the same person. Tested on the synthetic simulator instead (10 target riders x 10 impostors, same rigor: chronological split, conformal p-values, EER/AUC). Run: `python ml/scripts/evaluate_fusion.py`.

| Signal | Pooled EER | Pooled AUC | FRR@FAR=1% |
| --- | --- | --- | --- |
| Operational alone | 0.256 | 0.805 | 0.93 |
| Motion alone | 0.377 | 0.670 | 0.90 |
| Touch alone | 0.222 | 0.842 | 0.80 |
| **Fused (Fisher)** | **0.158** | **0.921** | **0.575** |
| Fused (noisy-OR) | 0.156 | 0.920 | 0.575 |

**This is a real, measured result, not an assumption:** fusing 3 individually-weak signals drops EER from 0.222 (best single) to 0.158, AUC rises from 0.84 to 0.92. Fisher's method and noisy-OR land almost identically here. Caveat: synthetic data tests the fusion *math*, not real multi-signal behavior — the per-signal real-data numbers above are the ones that test whether each signal carries real information. Both checks were necessary; neither alone would be honest. Even fused, `FRR@FAR=1%` of 0.575 is still not production-usable — this is exactly the gap Phase 2 (deep models) targets.

## Combiner rewiring: what changed and why

Wiring the combiner to real conformal p-values (instead of the old `1 - mean(anomaly_scores)`) surfaced a second real bug, on top of the fusion-math upgrade itself:

**The behavior-axis threshold had to be recalibrated, not just the fusion formula.** `classify()`'s `behavior_alpha` used to default to 0.6, inherited from the old scale where behavior_continuity was an average of three roughly-0.5-centered scores. A Fisher-fused p-value is uniformly distributed on [0,1] for genuinely normal behavior **by construction** — so a 0.6 cutoff, or even a textbook significance level like 0.05, both fail here for different reasons:
- 0.6 as a "stable" cutoff would flag ~60% of honest sessions (since P(uniform < 0.6) = 0.6).
- 0.05 (tried first) is the opposite failure: it caught essentially 0% of handoffs, because our per-signal EER is only ~0.22-0.44, so impostor fused p-values aren't concentrated near 0 the way a strict significance test assumes.

The fix: measured the actual EER-balancing threshold directly (`ml/scripts/evaluate_fusion.py`'s `eer()` call) — **0.29**, not derived from any convention. That's now `classify()`'s default. Same story for the red-team EWMA/frozen-anchor detectors in `test_redteam.py`: their thresholds (0.3 gap, 3.0 cumulative drift) were tuned for the old, tighter-spread scale and had to roughly double (0.6, 6.0) for the new, noisier p-value scale — confirmed by re-running the boiling-frog demonstration, which briefly broke (the fast baseline started "catching" the slow drift it's supposed to miss) until retuned.

**Takeaway for the pitch:** don't treat any of these thresholds as fixed constants. They're measured against the current signal set and will shift again once Phase 2 models change the underlying p-value distributions — recalibrate whenever the models change, the same way this round did.

## Known issues to fix next

1. **Mahalanobis is unreliable for high-dimensional signals (touch, motion) at this enrollment-set size.** Confirmed by the touch result above (AUC 0.454). Use IsolationForest for those; Mahalanobis stays viable for GPS (23 features) and operational (3 features), where dimensionality is much lower relative to enrollment size.
2. **Per-signal EER (~0.40-0.46) is the real bottleneck**, not the architecture. Fusion closes some of the gap (down to 0.158) but not enough for a strict security threshold. This is the direct justification for Phase 2: train sequence models (touch LSTM/1D-CNN autoencoder, GPS GRU+triplet encoder) and compare each against its classical baseline on this same harness — keep whichever wins.
3. **Single-session decisions are noisy** (documented from the earlier synthetic combiner tests) — a real deployment needs multi-session aggregation (EWMA/frozen-anchor, already built in `ml/redteam/detectors.py`) rather than a single-session verdict. This compounds with issue #2: weak per-signal EER makes single-session noise worse.
4. **Per-rider threshold calibration isn't wired yet** — `behavior_alpha=0.29` is one global value measured from the pooled synthetic cohort, not calibrated per rider from their own history (which is what the product actually promises: "at most X% false challenges for THIS rider"). That's the next calibration step once Phase 2 models are in.
5. ODIDMob route "directness" is a simplification (straight-line first-to-last-stop vs. total path length for the WHOLE multi-stop wave, not per-leg) — fine for a first pass, would need per-leg geometry mapping for a more precise version.

## Run everything

```bash
# Phase 1: real-data EER/AUC per signal (GPS, touch, motion)
python ml/scripts/run_phase1_evaluation.py

# Fusion check: does combining signals beat the best single signal? (synthetic)
python ml/scripts/evaluate_fusion.py

# Feature-extractor sanity / inter-person validation checks
python ml/scripts/validate_gps_on_geolife.py
python ml/scripts/validate_motion_touch_on_hmog.py
python ml/scripts/calibrate_sim_from_hmog.py

# Synthetic architecture checks (two-axis combiner, red-team, reason vector)
python ml/scripts/test_scorers.py
python ml/scripts/test_combiner.py
python ml/scripts/test_redteam.py
python ml/scripts/test_reason_vector.py   # set ANTHROPIC_API_KEY for real generated explanations
```

## Layout

```
ml/
  sim/rider_sim.py                      synthetic session + rider-persona generator
  data/odidmob_loader.py                streams ODIDMob_Routes GeoJSON, selects evaluation cohorts
  data/geolife_loader.py                GeoLife .plt parser (superseded by ODIDMob for GPS, kept for reference)
  data/hmog_loader.py                   H-MOG zip extraction + robust CSV reader (read_hmog_csv)
  features/gps_features.py              per-delivery-wave features from ODIDMob (23-dim)
  features/touch_features.py            per-stroke H-MOG features, distributional summary (59-dim)
  features/motion_features.py           windowed (2.5s, time+freq domain) H-MOG accel features (42-dim)
  features/operational_features.py      acceptance latency + time-of-day (3-dim)
  models/isolation_baseline.py          IsolationForest, raw_score() interface
  models/mahalanobis_baseline.py        shrinkage Mahalanobis distance, raw_score() interface
  calibration/conformal.py              ConformalScorer: raw_score -> proper p-value vs held-out calibration set
  calibration/fusion.py                 Fisher's method + noisy-OR p-value fusion, missing-signal policy
  evaluation/splits.py                  chronological enroll/calibrate/test split
  evaluation/metrics.py                 EER, AUC, FRR@FAR, bootstrap CI
  evaluation/harness.py                 signal-agnostic rider-disjoint evaluation loop
  scorers/*.py                          OLD mean-vector scorers, still used by the synthetic combiner/red-team tests
  combiner/two_axis.py                  context continuity x behavior continuity -> quadrant -> decision (now on Fisher-fused p-values)
  combiner/signal_models.py             fits per-rider IsolationBaseline+ConformalScorer per signal, feeds the combiner
  redteam/scenarios.py                  8 scenario generators (4 attacker types, copycat, 2 honest traps, cold-start)
  redteam/detectors.py                  EWMA fast-baseline, frozen-anchor drift, split-rental clustering
  llm/reason_vector.py                  Claude-generated rider-facing explanation for escalated sessions
  scripts/run_phase1_evaluation.py      real EER/AUC across GPS/touch/motion, both classical models
  scripts/evaluate_fusion.py            the fusion check (synthetic, see above)
  scripts/validate_gps_on_geolife.py    legacy GeoLife validation
  scripts/validate_motion_touch_on_hmog.py  legacy H-MOG validation (old mean-vector features)
  scripts/calibrate_sim_from_hmog.py    computes real accel variance from H-MOG to calibrate rider_sim.py
  scripts/test_scorers.py               synthetic honest-vs-handoff smoke test (old scorers)
  scripts/test_combiner.py              15-trial-per-scenario test of all 4 quadrants
  scripts/test_redteam.py               runs all red-team scenarios through the full pipeline
  scripts/test_reason_vector.py         full pipeline -> reason vector, with/without a live API key
data/
  ODIDMob_Routes/           real Beijing delivery routes, Feb 2020, per-day GeoJSON (primary GPS source)
  geolife/                  Microsoft GeoLife GPS trajectories (secondary/reference, 182 users)
  odidmobtraj/               old dead-end repo (viz + notebook only), kept for reference
  hmog/                      H-MOG per-user zips + data_description.pdf
```
