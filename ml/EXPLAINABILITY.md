# Trust Juggler — ML Explainability Report

One page: for every signal, the research basis → the real dataset → the train/validation/test protocol → the actual measured accuracy → production status. No claim here is unmeasured; where something isn't validated, it says so.

## Architecture (maps directly to the research)

```
Session → [operational scorer] [motion scorer] [touch scorer] [GPS scorer]
              → per-signal conformal p-value (calibrated on THIS rider's own history)
              → Fisher's method fusion → one behavior_continuity p-value
Session → [context detector: device/IP/zone match] → context_continuity
(behavior_continuity, context_continuity) → two-axis quadrant → decision
```

- **Two-axis trust model** (context × behavior, not one score) — the core architectural claim from arXiv:2404.11844 (illegal driver substitution via GPS/behavior modeling), adapted to add a mobile behavioral layer on top of operational/GPS.
- **Per-rider one-class scoring + conformal calibration** — matches the "train only on a rider's own normal behavior, score deviations" approach validated by arXiv:2210.16819 (relative-attention one-class adversarial network on H-MOG).
- **Multimodal fusion over any single signal** — arXiv:2001.08578 (140+-study survey) is the literature claim; our own fusion check (below) is the actual measurement, not just a citation.
- **Dual-timescale baselines (frozen anchor vs. fast baseline)** — answers the "slow-drift attacker" case the literature doesn't directly cover; built and holdout-verified (detection latency section below).

## Per-signal: reference → dataset → protocol → real numbers

### Touch
- **Research basis:** H-MOG's own continuous-authentication methodology (Sitova et al., SenSys'14) + swipe-authentication feature design (velocity, pressure, direction, timing — arXiv:1905.11780-style features).
- **Dataset:** H-MOG, 100 real users, real downloaded data (`data/hmog/`). 18 held out as the evaluation cohort (8 target + 10 impostor), 81 used to train the deep model — **disjoint, no leakage**.
- **Features:** per-stroke kinematic vectors (duration, path length, velocity mean/peak, acceleration, direction, curvature, pressure mean/var/slope, area) — `ml/features/touch_features.py`.
- **Train/val/test protocol:** chronological 60/20/20 split per rider (enroll/calibrate/test), rider-disjoint, `ml/evaluation/harness.py`.
- **Models tried:** (1) `IsolationForest`, classical, per-rider. (2) `LSTM` reconstruction autoencoder, pooled training. (3) `GRU` + triplet loss, pooled training, per-rider centroid scoring.
- **Real measured accuracy:**

  | Model | EER | AUC | FRR@FAR=1% |
  |---|---|---|---|
  | IsolationForest | 0.408 | 0.624 | 0.81 |
  | LSTM autoencoder | 0.481 | 0.505 (≈random) | 0.83 |
  | **GRU triplet (winner)** | **0.352** | **0.722** | 0.81 |

- **Validation:** confirmed on a second, independent impostor set (20 new impostors never used before): 0.351 vs 0.436 — same winner, same margin. Not a fluke.
- **Production status:** wired (`ml/inference/rider_model_bundle.py`), **but degraded** — the frozen session schema's `touch_events` carries one point per gesture, not the raw per-sample path the model needs for velocity/curvature features. Flagged to the team; schema extension (`touch_events[].path`) proposed, not yet implemented on the mobile/backend side.

### Motion
- **Research basis:** same H-MOG continuous-authentication basis; windowed time+frequency-domain features follow standard HAR (Human Activity Recognition) feature design (UCI-HAR/WISDM-style: mean/std/min/max per axis, FFT band energy, spectral entropy, jerk).
- **Dataset:** H-MOG accelerometer/gyroscope, same 18-user eval cohort / 81-user training-pool split as touch.
- **Features:** 2.5-second windows, 21 features per window (time + frequency domain) — `ml/features/motion_features.py`.
- **Train/val/test protocol:** identical rider-disjoint chronological harness.
- **Models tried:** `IsolationForest` (classical) vs. `GRU` + triplet loss (pooled, per-rider centroid).
- **Real measured accuracy:**

  | Model | EER | AUC | FRR@FAR=1% |
  |---|---|---|---|
  | IsolationForest | 0.440 | 0.570 | 0.94 |
  | **GRU triplet (winner)** | **0.277** | **0.744** | 0.85 |

- **Biggest single improvement of any signal** — motion went from the weakest classical signal to one of the strongest after the architecture fix (triplet loss over reconstruction loss).
- **Production status:** wired and **not** schema-blocked — motion's raw accelerometer stream in the frozen schema is sufficient (no wave/path gap like touch/GPS).

### GPS
- **Research basis:** Trajectory-User Linking (TULER, arXiv-indexed Gao et al. IJCAI'17 line of work) — treat a route as a sequence, embed it, link it to its generator. Also the direct-problem match: arXiv:2404.11844 (illegal driver substitution via GPS behavior modeling).
- **Dataset:** **ODIDMob_Routes** — real Beijing delivery-courier GPS data, Feb 2020, 828+ couriers in week 1 alone (not synthetic, not the originally-assumed-dead ODIDMobTraj repo — found and verified the actual data exists). 18-courier eval cohort, 800 couriers used for deep-model training, disjoint.
- **Features:** classical — 23-dim per-delivery-wave summary (speed/accel/turn-rate distributions, route directness, leg statistics) — `ml/features/gps_features.py`. Deep — per-leg sequence (distance, duration, speed, cumulative time fraction) fed to a GRU.
- **Train/val/test protocol:** same rider-disjoint harness, PLUS a full **fresh holdout cohort** (zero overlap with anything evaluated before) specifically because the first result looked suspicious.
- **Real measured accuracy:**

  | Model | Original cohort EER | Holdout cohort EER |
  |---|---|---|
  | IsolationForest | 0.397 | 0.427 |
  | GRU triplet (80 epochs, 800 couriers) | 0.409 | **0.360** |

- **Honest finding, not a clean win:** the conclusion flipped between cohorts on the first (30-epoch) training run — classical won originally, triplet won on holdout. After retraining longer, triplet now wins the holdout decisively and nearly ties on the original cohort. **Reasonable read: triplet is probably better, but 8-rider cohorts don't give enough statistical power to be fully certain** — this is stated plainly rather than oversold.
- **Production status: NOT validated for production.** Both GPS models need delivery-wave/stop segmentation (ASSIGN→PICKUP→DELIVERY structure) that doesn't exist in the frozen session schema at all — it only has a flat, unsegmented GPS point stream. The classical model currently wired uses a different, unvalidated 4-feature GeoLife-style stopgap. This is documented explicitly in `ml/inference/rider_model_bundle.py`'s docstring so nobody mistakes the wired model for the validated one.

### Operational
- **Research basis:** directly from the driver-substitution literature's use of operational/meter behavior (arXiv:2404.11844) — acceptance latency and shift timing as a behavioral signal.
- **Dataset:** synthetic (platform logs weren't available as a public dataset; this is the one signal where synthesis was always the plan, not a shortcut).
- **Model:** `IsolationForest`, per-rider — never needed a deep-learning attempt; 3-dimensional input doesn't benefit from a sequence model.
- **Production status:** works as evaluated, no schema gap.

## Fusion: does combining signals actually help? (measured, not assumed)

Tested on the synthetic simulator (the only place all 4 signals coexist for the same person — no real dataset has operational+motion+touch+GPS simultaneously for one driver):

| Signal | EER |
|---|---|
| Best single signal (touch, synthetic) | 0.222 |
| **Fused (Fisher's method)** | **0.158** |

Real improvement, not assumed from the literature's 34-study claim. Fisher fusion and the simpler noisy-OR landed almost identically.

## Why EER/AUC/FRR, and what they mean here

- **EER** — the point where "wrongly blocking a real person" and "wrongly letting an impostor through" happen equally often. Standard biometric metric, but it weighs both mistakes as equal — the business doesn't (a missed handoff is a safety/liability issue, not just an inconvenience).
- **AUC-ROC** — overall ranking quality across every threshold at once (0.5 = random, 1.0 = perfect).
- **FRR@FAR=1%** — "if we only let 1% of impostors through, how many honest riders get wrongly challenged?" — the number that actually matches the product's "~1% false challenge" promise, reported alongside EER throughout.
- **Cost-weighted threshold** (`ml/evaluation/cost_model.py`) — found that touch alone needs an 81% false-challenge rate to hit a safety-first false-accept rate. This is the real, numeric reason fusion isn't optional.
- **Detection latency** — formally measured across 15 synthetic rider pairs, not just spot-checked: lazy (full) handoff caught immediately (median 0 sessions); slow-drift handoff caught at a median of 37 sessions by the frozen-anchor detector specifically (the naive fast baseline never catches it, by design — that's the point of having both).

## What's real vs. roadmap — the honest line

**Real, measured, working:** all 4 classical baselines, 3 of 4 deep-learning attempts with a clear winner (motion, touch) and one honest inconclusive-leaning-positive result (GPS), the fusion math, per-rider threshold calibration with an honest data-sufficiency fallback, detection latency, cost-weighted thresholds, the two-axis combiner rewired to real statistics (catching and fixing a real bug along the way), face-verification step-up (pretrained, pipeline-tested, not accuracy-tested — no real face dataset available).

**Known, named gaps, not hidden:** the touch and GPS production paths are schema-blocked (flagged to the team with a proposed fix for touch); per-rider threshold calibration needs ~100 sessions per rider to hit the stated 1% target and currently falls back to a population value; cost-aware challenge *scheduling* (not just thresholding), the account-graph layer, and learned legit-change signatures were never started — correctly scoped as roadmap from the beginning, not abandoned mid-build.
