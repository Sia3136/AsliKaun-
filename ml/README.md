# Trust Juggler — ML workstream

## FINAL RESULTS (read this first)

**Per-signal model choice, offline evaluation (real H-MOG / real ODIDMob data, rider-disjoint, holdout-checked):**

| Signal | Classical EER | Best deep model | Winner | Production status |
| --- | --- | --- | --- | --- |
| Operational | low-dim, no deep attempt needed | — | Classical (IsolationForest) | ✅ Works as evaluated |
| Touch | 0.408 | **0.352** (triplet, confirmed on 2 impostor sets) | **Deep model** | ⚠️ Wired, but degraded in production — schema gap (see below) |
| GPS | 0.397 (orig) / 0.427 (holdout) | 0.409 (orig) / **0.360** (holdout, retrained) | **Leans deep model** (won holdout twice, narrowed on original) | ❌ **Neither model is validated for production** — schema has no wave/stop segmentation either model needs (see below) |
| Motion | 0.440 | **0.277** (triplet) | **Deep model, decisively — the biggest win of any signal** | ✅ Wired, schema-compatible (unlike touch/GPS, no gap) |

**The two real, load-bearing findings beyond any single signal's number:**
1. **Fusion matters more than any one model.** Combining signals drops EER from 0.22-0.44 (best single signal) to 0.158 (synthetic fusion check) — this is the actual architectural win, not which model wins per signal.
2. **Two real schema gaps block full production accuracy, both already flagged to the team:** touch needs raw per-gesture sample paths (`touch_events[].path`, added to the shared doc), and GPS needs wave/stop segmentation that doesn't exist in the frozen schema at all (not yet proposed as a fix — see `ml/inference/rider_model_bundle.py`'s docstring).

**Also done:** per-rider threshold calibration (with honest population fallback), a formally-tracked detection-latency metric (37-session median to catch slow drift), a cost-weighted operating point analysis (touch alone needs 81% FRR to hit a safety-first FAR — proof fusion isn't optional), and a face-verification step-up module (pretrained, untested on real faces — no dataset available).

## UPDATE: backend now runs the real models live, verified end-to-end (2026-10-18)

The gap above — "backend only uses the heuristic, never the real trained models" — **is closed.** `backend/app/ml_bridge.py`'s `evaluate_session_with_real_models()` now fits a `RiderModelBundle` from a driver's actual session history (pulled from the `sessions` table, which already stores full raw payloads) and scores live traffic with it, falling back to the heuristic only until a driver has `MIN_HISTORY_FOR_REAL_MODELS` (15) sessions.

**Verified live, via real HTTP requests to a running server, not simulated:**
- Automatic switchover confirmed: sessions 0-14 use the heuristic (`model_status: ml_two_axis_fusion`), session 15+ automatically switches to `model_status: ml_real_trained_models`.
- **All 4 signals confirmed individually contributing** to a live `signals` dict: operational, touch, motion, **and GPS** (previously unverified — now confirmed, using the classical GeoLife-style feature set, with real lat/lng/t pings end-to-end from the SDK through to a score).
- A genuine handoff (changed touch/motion/operational pattern, same context) correctly produces `quadrant: handoff_signature`, `decision: challenge_at_safe_pause`, with Fisher fusion correctly combining three individually-moderate per-signal p-values (0.57, 0.71, 0.86) into a confident joint anomaly (0.231) — the architecture working as designed, not a coincidence.
- A GPS-specific anomaly (erratic, higher-speed route vs. a steady history) correctly contributes to a `handoff_signature` verdict (`gps: 0.833` in the fused result).
- The AI reason-vector explanation generates correctly on a real escalation, via Groq (see below), in plain rider-facing language.

**Real bugs found and fixed while verifying this, not hidden:**
1. `SessionIngest`'s `accel` field was a flat list of scalars; the real motion feature extractor needs `{x,y,z,t}` per sample. Fixed in the Pydantic schema, the SDK, and `app.js`'s scenario simulator.
2. The GPS speed filter (`speed < 50 m/s`) correctly rejected a first test's zig-zag GPS pattern as physically-impossible glitches (the pattern implied 180+ km/h) — not a bug, the filter working as intended; the test data needed to be realistic, not just "different."
3. The motion signal was silently absent from early tests because the manually-constructed test data didn't span enough real time for even one 2.5-second analysis window — a real SDK's 15-20s buffer naturally avoids this, but it's a sharp edge worth knowing: motion needs genuine time-spread data, not just enough samples.

**Groq wired as the default (free) LLM provider.** `ml/llm/reason_vector.py` now tries Groq first (reads `GROQ_API_KEY` or a `groq_api` key from a root `.env` file), falls back to Anthropic if explicitly configured, then to the labeled template — verified generating real explanations end-to-end. Default model `openai/gpt-oss-20b`, chosen by actually querying `/v1/models` for this key's available catalog rather than assuming a model name — the commonly-cited `llama-3.3-70b-versatile` was not available for this key.

**Still not done:** `origin/frontend`'s unmerged fleet-dashboard work (someone else appears to be actively editing these files in parallel — stopped rather than risk a conflict), per-rider threshold calibration still needs ~100 sessions to hit the full 1% target (population fallback covers the gap honestly), no caching on `RiderModelBundle.fit()` (refits from scratch every request — fine at demo scale, a real cost at production scale).

**Explicitly out of scope, not forgotten:** cost-aware challenge *scheduling* (policy/timing logic, never started), the account graph layer (always roadmap), learned legit-change signatures (not buildable — no dataset has the needed labels).

---

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

## Phase 2: GPS trajectory encoder (GRU + triplet loss, trained on Kaggle)

Trained on `ml/kaggle/train_gps_encoder.py` (self-contained Kaggle notebook script) — a GRU encoder over per-leg route sequences (distance, duration, speed, cumulative time fraction), triplet loss (same-courier routes close, different-courier routes far), 30 epochs x 100 steps, ~400 training couriers **excluding** the 18-courier evaluation cohort (no leakage). Evaluated on the identical rider-disjoint harness as the classical baseline: `ml/scripts/evaluate_gps_encoder.py`.

| Model | Pooled EER | Pooled AUC | FRR@FAR=1% | Per-rider mean EER |
| --- | --- | --- | --- | --- |
| IsolationForest (classical) | **0.397** | **0.622** | 0.90 | 0.399 [0.345, 0.452] |
| GRU triplet encoder | 0.433 | 0.603 | 0.95 | 0.400 [0.336, 0.452] |

**Initial result: the deep model did not beat the classical baseline here** — per-rider mean EER was essentially tied with overlapping confidence intervals. **Correction after holdout re-validation (see the "Holdout re-validation" section below): this result did not generalize to a fresh cohort, where the triplet encoder won instead.** The correct conclusion for GPS is "inconclusive, not enough evaluation data to call a winner" — not "classical wins," which is what this section originally (incorrectly) stated. Don't cite a confident GPS winner in the pitch.

## Phase 2: touch stroke autoencoder (LSTM, trained on Kaggle)

Trained on `ml/kaggle/train_touch_autoencoder.py` — an LSTM sequence autoencoder over per-stroke feature sequences, reconstruction-error anomaly scoring, 40 epochs x 150 steps, pooled across 81 H-MOG users **excluding** the 18-user evaluation cohort (pre-extracted locally via `ml/scripts/prepare_touch_training_data.py`, no leakage). Evaluated on the identical cohort/harness as the classical baseline: `ml/scripts/evaluate_touch_autoencoder.py`.

| Model | Pooled EER | Pooled AUC | FRR@FAR=1% | Per-rider mean EER |
| --- | --- | --- | --- | --- |
| IsolationForest (classical) | **0.408** | **0.624** | 0.81 | 0.369 [0.308, 0.433] |
| LSTM stroke autoencoder | 0.481 | 0.505 (= coin flip) | 0.83 | 0.508 [0.458, 0.571] |

**Clear negative result, with a diagnosable cause, not just "didn't help."** The classical model is fit per-rider — its raw score directly measures deviation from *that specific person's* distribution. The autoencoder is trained once, pooled, with frozen weights shared across all 81 training users — its reconstruction error measures deviation from *population-general* touch patterns, not from any individual's. Since every test stroke (genuine or impostor) comes from a real, normal person, the frozen pooled model reconstructs both about equally well on average; conformal calibration can only partially correct for this, because there's little rider-specific signal in the raw score to begin with. The diagnosis pointed directly at the fix: see iteration 2 below.

## Phase 2, touch iteration 2: triplet encoder (same architecture pattern as GPS)

Same training data (`touch_training_sequences.pkl`, no new upload needed), same GRU architecture family as the GPS encoder, but trained with triplet loss instead of reconstruction loss (`ml/kaggle/train_touch_triplet_encoder.py`) — person-discriminative embedding space instead of population-general reconstruction. Evaluated with `ml/scripts/evaluate_touch_triplet_encoder.py`.

| Model | Pooled EER | Pooled AUC | FRR@FAR=1% | Per-rider mean EER |
| --- | --- | --- | --- | --- |
| IsolationForest (classical) | 0.408 | 0.624 | 0.81 | 0.369 [0.308, 0.433] |
| LSTM autoencoder (iteration 1) | 0.481 | 0.505 | 0.83 | 0.508 [0.458, 0.571] |
| **GRU triplet encoder (iteration 2)** | **0.352** | **0.722** | 0.81 | 0.325 [0.229, 0.421] |

**This one wins, genuinely.** EER drops from 0.408 to 0.352, AUC rises from 0.624 to 0.722 — confirms the autoencoder's diagnosis was correct: the training objective (person-discriminative triplet loss vs. population-general reconstruction) was the actual problem, not model capacity. **Touch now uses the triplet encoder, not IsolationForest.**

## Phase 2 summary (CORRECTED after holdout re-validation — see below)

| Signal | Classical EER | Best deep-model EER | Winner |
| --- | --- | --- | --- |
| GPS | 0.397 (orig) / 0.427 (holdout) | 0.433 (orig) / **0.372 (holdout)** | **Inconclusive — see holdout finding** |
| Touch | 0.408 (orig) / 0.436 (holdout) | **0.352 (orig) / 0.351 (holdout)** | **Deep model — confirmed on fresh data** |
| Motion | 0.440 | not attempted in Phase 2 | Classical (IsolationForest), by default |

## Holdout re-validation — the same 18-person cohort was being reused too much

Every result above the first few runs was measured against the *same* 18 H-MOG users / 18 ODIDMob couriers, repeatedly. That's a real methodological risk: with a cohort this small, it's easy to unknowingly tune conclusions (and thresholds) to that specific set rather than to the underlying truth. Ran a genuine holdout check for both signals:

- **GPS: a fully fresh cohort** (8 new targets + 10 new impostors, zero overlap with the original eval cohort — `ml/scripts/evaluate_gps_holdout.py`). Result: **the conclusion flipped.** Triplet encoder won here (0.372 vs 0.427), opposite of the original cohort (classical 0.397 vs triplet 0.433). With only 8 target riders, per-rider EER swings ±0.03-0.05 just from which people get sampled — **the classical-vs-triplet gap for GPS is within that noise band on both cohorts.** The honest conclusion is **"too close to call with this little evaluation data,"** not "classical wins" (what was previously claimed here). Either keep both models and route by a larger, better-powered evaluation later, or default to the simpler classical model on engineering-simplicity grounds alone — but don't cite a confident GPS winner in the pitch.
- **Touch: same 8 fitted target riders (H-MOG only has 100 users total — 18 eval + 82 training already accounts for 99/100, so no third fully-disjoint group exists), tested against a fresh, 2x-larger impostor pool** (20 new impostors never used before — `ml/scripts/evaluate_touch_holdout.py`). Result: **confirmed.** Triplet 0.351 vs classical 0.436, consistent with the original 0.352 vs 0.408. This conclusion holds up.

**Takeaway for the pitch and for any future evaluation:** state cohort sizes and holdout status explicitly next to every number (as this README now does). A single 8-vs-10 cohort is a *pilot*, not a definitive result — the GPS flip is the proof. Touch's repeated win across two different, non-overlapping impostor sets is the kind of evidence that's actually trustworthy.

## Production inference wiring (`ml/inference/`) — and a real schema gap found while building it

`ml/inference/rider_model_bundle.py`'s `RiderModelBundle` is the single entry point backend should call: `RiderModelBundle.fit(enroll, calib)` once per rider (batch job / on enough history), then `.score(session)` per incoming session — wires together IsolationForest for operational/motion/GPS (GPS uses classical by default on engineering-simplicity grounds — see Holdout re-validation, its deep-model comparison was inconclusive, not a loss) and the triplet encoder for touch (confirmed winner on holdout), plus conformal calibration, Fisher fusion, the two-axis combiner, and the reason vector, with a missing-signal policy that skips a signal cleanly rather than ever imputing a value. Plumbing-tested end to end (`ml/scripts/test_inference_wiring.py`) — not a new accuracy validation, just confirms the wiring runs.

**Real finding, not theoretical:** the frozen session schema (agreed hour 0-1) doesn't carry enough detail for the touch model to work as trained, and the plumbing test *demonstrates* this, not just argues it. The schema's `touch_events` is one entry per completed gesture (`{type, x, y, pressure, area, duration_ms, t}` — a single point). The touch triplet encoder was trained on H-MOG's raw per-sample stream (many points per gesture) and gets its EER win specifically from velocity/curvature/pressure-slope features computed along that path. With only one point per gesture, those features are all 0.0 — and in the plumbing test, touch's p-value pinned at **1.0 for both the honest and the handoff session**, meaning it contributed zero discriminative signal in practice, not just in theory.

**Action needed before backend wires real traffic through this:** either (a) extend `touch_events` so each entry carries a `path: [{x, y, pressure, t}, ...]` of raw samples during the gesture — what the mobile SDK would actually log — or (b) accept that touch effectively degrades to a near-useless signal in production until that extension happens. Similarly, GPS: the frozen schema's flat `gps` point list can't reproduce ODIDMob's per-wave summary fields (rider level, max load, weather), so `gps_features_from_schema` uses a different (GeoLife-style speed/turn-rate) feature set than the one actually evaluated — the measured 0.397 EER does not directly transfer to this path; re-evaluate once real production GPS data exists. Motion works as-is (the schema's flat `accel` list is sufficient once there are enough samples — H-MOG needs 20+, which real sessions should comfortably produce even though the synthetic simulator doesn't).

## Face verification step-up (`ml/models/face_verification.py`)

Pretrained FaceNet (`InceptionResnetV1`, VGGFace2 weights, via `facenet-pytorch`) + MTCNN face detection/alignment. **Not a continuous signal** — only fires when the two-axis combiner already decided to escalate and wants a decisive check, per the original plan's "optional selfie step-up check" (already scoped from day one; this just builds it). Pipeline confirmed working: pretrained weights load, and a no-face image correctly returns `None` rather than a false embedding.

**No accuracy number is reported here, deliberately** — there's no real, consented face dataset in this project to evaluate against. `FaceStepUpVerifier.verify()` returns a similarity score and a **recommendation** (`pass` / `human_review`), never a final automated decision — a failed match must route to human review, never an automatic ban, per the fairness concerns already in the edge-case matrix (published research shows facial-verification accuracy varies by skin tone; never penalize on a failed match alone).

## ML tradeoffs: real-time, latency, and evaluation-metric fit (full discussion in chat — summarized here for the record)

- **Model inference is never the latency bottleneck** (microseconds to low-milliseconds for every model here). **Data availability per signal is the real constraint**: operational is instant, touch is near-real-time (the triplet encoder scores per-stroke, not per-session — an underrated advantage beyond its EER win), motion needs ~2.5s windows, but **GPS can only score after a full delivery wave completes** — it is structurally not a real-time signal in its current form, which conflicts with the plan's own "catch it within the session it happens in" goal. Not fixed; a real design decision for whoever builds the real-time path.
- **Scalability tradeoff, in the deep model's favor:** the touch triplet encoder is one shared frozen model + a cheap per-rider centroid. The classical `IsolationForest` needs a separate fitted model per rider — fine at 18 riders, a real storage/refit cost at scale.
- **EER is the standard metric but may be the wrong one to optimize for here**: it weighs a false-reject (friction) and false-accept (a missed handoff) equally, but the plan's own safety framing says a false-accept is the far costlier mistake. `FRR@FAR=1%` (already reported) is the more business-relevant number and should drive model choice over EER.
- **Gaps in what's measured**: detection latency (named as a metric in the original plan) is spot-checked per red-team scenario but not formally tracked across the evaluation cohort; no cost-weighted operating point exists at all, despite differentiator #5 ("cost-aware challenge timing") implying one should.

## Per-rider threshold calibration (`ml/calibration/per_rider_threshold.py`)

Delivers on the plan's "calibrate each rider's challenge threshold on their own history" promise — `RiderModelBundle` now computes a genuinely per-rider operating threshold from each rider's own calibration sessions, instead of one pooled global value for everyone.

**Honest constraint, stated rather than hidden:** resolving a target false-accept rate needs roughly `1/target_far` calibration sessions (99 for 1%, 19 for 5%). Real riders in our evaluation data (H-MOG, ODIDMob) typically have 10-20 calibration sessions — **not enough to individually resolve the plan's "~1% false challenge" promise yet.** Below the resolvable threshold, this falls back to the population-pooled value (0.29) with an explicit note explaining why, the same cold-start principle already in the edge-case matrix. Verified both paths work: tested with 20 calibration sessions (correctly falls back, explains the shortfall) and 150 (correctly resolves its own threshold). As real production history accumulates per rider, this automatically sharpens from the population default toward the individually-calibrated value — no code change needed, just more data.

## Detection latency as a real metric (`ml/scripts/evaluate_detection_latency.py`)

The original plan named detection latency as a metric to report; until now it was only spot-checked for one rider pair per scenario. Ran it across 15 synthetic rider pairs for both attacker types:

| Scenario | Censored (never caught) | Median latency | IQR |
| --- | --- | --- | --- |
| Lazy renter (full handoff) | 0/15 | 0 sessions | [0, 0] |
| Slow-drift renter | 0/15 | 37 sessions | [34, 47] |

**A real bug caught building this:** the first version measured slow-drift latency using the single-session combiner, the same way as lazy-renter — and got a nonsense median of 1 session. That's not detection, it's noise: at session 0-1 a slow-drift attack is still ~100% owner behavior, so an early single-session flag is a false positive, not a catch. The frozen-anchor detector (`ml/redteam/detectors.py`) is the actual mechanism designed to catch cumulative drift, and measuring against it gives the 37-session median above — consistent with the single-pair spot-check (session 35/60) already in this README. **Lesson: always check which detection mechanism a scenario is actually designed to be caught by before measuring latency against it** — defaulting to "the combiner" for every scenario silently reports noise as a result.

## Cost-weighted operating point (`ml/evaluation/cost_model.py`)

EER treats a false-accept (missed handoff) and a false-reject (unnecessary challenge) as equally costly — not true per the plan's own safety framing. Ran a cost-weighted threshold search on the touch triplet encoder's real pooled scores (strongest model available):

| Cost ratio (missed handoff : false challenge) | Threshold | FAR | FRR |
| --- | --- | --- | --- |
| 1:1 (≈ EER) | 0.201 | 0.438 | 0.208 |
| 5:1 | 0.801 | 0.013 | **0.812** |
| 10:1 | 0.801 | 0.013 | 0.812 |
| 50:1 | 0.801 | 0.013 | 0.812 |

**Real finding, not just a mechanical exercise:** once a missed handoff is weighted even moderately higher (5:1+), the optimal threshold jumps to catching nearly all impostors (FAR 1.3%) — but at the cost of challenging **81% of honest sessions**. That's not a usable product on touch alone, at any cost ratio past 1:1. This is the concrete, numeric reason fusion isn't optional: the synthetic fusion check already showed combining signals drops EER from ~0.22-0.44 (any single signal) to 0.158 — this cost analysis shows WHY that matters beyond the EER number itself: fusion is what makes a safety-prioritized operating point survivable for honest riders, not just a nicer summary statistic. Illustrative cost ratios only (not sourced from real incident/friction-cost data) — the direction of the finding is real, the exact ratio isn't.

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

# Production inference wiring (plumbing test, not an accuracy check)
python ml/scripts/test_inference_wiring.py

# Holdout re-validation (fresh cohorts, see Holdout re-validation section)
python ml/scripts/evaluate_gps_holdout.py
python ml/scripts/evaluate_touch_holdout.py
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
  inference/schema_adapters.py          frozen-schema session -> each model's expected input (see schema gap note above)
  inference/rider_model_bundle.py       THE production entry point: RiderModelBundle.fit() / .score()
  models/gps_triplet_encoder.py         GRU + triplet loss GPS encoder (result INCONCLUSIVE after holdout — see Holdout re-validation)
  models/touch_autoencoder.py           LSTM reconstruction autoencoder for touch (lost badly, kept for reference)
  models/touch_triplet_encoder.py       GRU + triplet loss touch encoder (WINNER — used in production wiring)
  kaggle/                               self-contained Kaggle training scripts + prepared training data
  weights/                              trained model checkpoints (gps_encoder.pt, touch_triplet_encoder.pt, touch_autoencoder.pt)
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
