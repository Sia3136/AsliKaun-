# Trust Juggler — ML workstream

## Status

| Component | State |
| --- | --- |
| Session schema + synthetic rider simulator (`ml/sim/rider_sim.py`) | Done — generates honest and handoff sessions for any two rider personas |
| Operational scorer (`ml/scorers/operational.py`) | Done, tested — separates honest/handoff on acceptance-latency + time-of-day |
| Touch scorer (`ml/scorers/touch.py`) | Done, tested — separates on tap pressure/rhythm |
| Motion scorer (`ml/scorers/motion.py`) | Done but weak separation on synthetic accel — needs either richer synthetic motion features or H-MOG-derived ones |
| GPS scorer (`ml/scorers/gps.py`) + GeoLife loader (`ml/data/geolife_loader.py`) | Done, **validated on real data**: fit on GeoLife user 000's trajectories, scores user 001's trajectories 0.57 vs 0.38 on own held-out data — real inter-person separation, not synthetic |
| H-MOG dataset + loader (`ml/data/hmog_loader.py`) | Done, **validated on real data**: motion 0.39 (self) vs 0.55 (other user), touch 0.53 vs 0.91 — touch separation is strong, motion separation is real but modest. This confirms the earlier synthetic-only motion weakness was a simulator-fidelity problem, not a feature problem |
| ODIDMobTraj | **Not usable** — the GitHub repo ships only a viz page + notebook; the actual GeoJSON file lives on Figshare behind a DOI the README never filled in. Dropped in favor of GeoLife. |
| Two-axis combiner (`ml/combiner/two_axis.py`) | Done, tested — all 4 quadrants classify correctly on a 15-trial majority vote per scenario, including the key proof: same-magnitude context change, opposite verdict depending on whether behavior moved with it |
| Red-team simulator (`ml/redteam/`) | Done, tested — 4 attacker types + 2 honest-rider traps, see results below |
| Reason-vector LLM call (`ml/llm/reason_vector.py`) | Done, tested — calls Claude only for escalated sessions (cost control); falls back to a clearly-labeled template when no `ANTHROPIC_API_KEY` is set, so the pipeline runs end-to-end either way |

## Known issues to fix next

1. **Motion alone is a genuinely weak single signal — confirmed, not a bug.** `rider_sim.py`'s `accel_signature`/`accel_noise` are now calibrated to real H-MOG inter- and intra-person variance (`ml/scripts/calibrate_sim_from_hmog.py`, run on 24 real users): between-person std ~0.84/axis, within-person std ~0.74-1.37/axis. The calibration itself was the finding — within-person session-to-session wobble is *comparable to or larger than* between-person spread in real data, so a single session's mean-accel-vector barely separates honest from handoff even on real people (H-MOG: 0.39 vs 0.55 — real but modest). After recalibrating, the synthetic test shows the same thing (0.515 vs 0.483, no real separation for a single random owner/renter pair). This is exactly why the architecture doesn't rely on motion alone: operational (0.41 vs 0.62) and touch (0.52 vs 0.82) still carry honest/handoff separation cleanly, and the combiner's 4-quadrant classification still passes on majority vote with motion this weak — direct evidence for the "multimodal fusion beats any single signal" claim in the literature review, not just a citation. Don't present the motion signal alone as a strong detector in the pitch; present it as one of several signals whose combination is the actual claim.
2. **Single-session decisions are noisy.** The combiner's 4-quadrant test only holds on a *majority vote over 15 trials* per scenario, not on any one session (a lone honest session landed in `handoff_signature` 3/15 times, see `test_combiner.py`'s output). A real deployment needs either a bigger calibration set per rider, an EWMA/rolling-window decision rather than a single-session verdict, or both — don't demo on a single cherry-picked session without mentioning this.
3. **Why the fix mattered:** the first version of the combiner flagged every honest session as a handoff (0.42–0.47 trust_score across the board). The root cause was calibrating each scorer's percentile-rank baseline against its own *training* data — IsolationForest's raw decision_function is systematically biased toward looking "more normal" on the exact points it was trained on, so any unseen point (even a genuinely honest one) scored artificially anomalous by comparison. Fixed by splitting each rider's history into a fit set and a disjoint calibration set (`ml/scorers/base.py`). This is the kind of bug the deep-ml-research debugging order (leakage → label construction → split logic → ...) exists to catch — it looked like a weak-signal problem but was actually a train/calibration leakage problem.

## Red-team results (`ml/scripts/test_redteam.py`)

| Scenario | Result |
| --- | --- |
| Lazy renter (full handoff) | Caught at session 0 by the combiner, as expected — this is the easy case |
| Slow-drift renter (60-session ramp) | The naive EWMA "fast baseline" **never** flags it (by design — this is the vulnerability it demonstrates). The frozen-anchor detector catches it at session 35/60. This is the real proof for differentiator #4 (dual-timescale baselines) |
| Split-shift sharer (owner mornings, renter evenings) | The combiner alone doesn't distinguish this from one noisy rider. A 2-component Gaussian mixture on operational+touch features fits meaningfully better than 1 component (BIC -156 vs 174) AND the two clusters' mean hour-of-day differ by 14 hours — correctly flagged as `split_rental_suspected: True`. Proof for differentiator #3 |
| Honest phone+city change | Combiner lands in `ambiguous`, not `handoff_signature` — correctly less severe than a true handoff, though single-session noise means this isn't rock-solid (see known issue #2) |
| Honest illness/rough-roads (behavior dips, same context) | The EWMA fast-baseline does **not** flag it (a one-time dip doesn't look like sustained drift) — good sign this won't misfire on temporary behavior shifts |

**Important tuning note:** getting the slow-drift result right took two iterations. A rolling-*window*-mean "fast baseline" (the first version) actually caught the drift too, because a trailing window mean of a linear ramp lags by a roughly constant amount set by the window size — it isn't actually vulnerable to gradual drift the way the differentiator claims. The real vulnerability only shows up with an EWMA baseline that absorbs every session's value regardless of outcome (`ml/redteam/detectors.py`'s `FastBaselineDetector`). This matters for the pitch: the claim is specifically about EWMA/exponentially-adaptive baselines, not any rolling-window approach, and the demo should reflect that precisely.

## Run the scorers

```bash
python ml/scripts/test_scorers.py
python ml/scripts/validate_gps_on_geolife.py
python ml/scripts/validate_motion_touch_on_hmog.py
python ml/scripts/test_combiner.py
python ml/scripts/test_redteam.py
python ml/scripts/test_reason_vector.py   # set ANTHROPIC_API_KEY to get real generated explanations
```

## Layout

```
ml/
  sim/rider_sim.py                      synthetic session + rider-persona generator (context_override for legit changes)
  data/geolife_loader.py                parses GeoLife .plt files, computes speed/turn-rate features
  data/hmog_loader.py                   extracts + parses H-MOG per-user zips, computes motion/touch features
  scorers/base.py                       shared IsolationForest + held-out percentile calibration
  scorers/operational.py                Tier-1: acceptance latency, time-of-day
  scorers/motion.py                     Tier-2: accelerometer signature (swap in H-MOG-trained model later)
  scorers/touch.py                      Tier-3: tap pressure, area, rhythm
  scorers/gps.py                        GPS/mobility signature, validated on real GeoLife data
  combiner/two_axis.py                  context continuity x behavior continuity -> quadrant -> decision
  redteam/scenarios.py                  4 attacker types + 2 honest-rider trap generators
  redteam/detectors.py                  EWMA fast-baseline, frozen-anchor drift, split-rental clustering
  scripts/test_scorers.py               side-by-side honest-vs-handoff smoke test (operational/motion/touch)
  scripts/validate_gps_on_geolife.py    real-data validation for the GPS scorer
  scripts/validate_motion_touch_on_hmog.py  real-data validation for motion + touch scorers
  scripts/calibrate_sim_from_hmog.py    computes real accel variance from H-MOG to calibrate rider_sim.py
  scripts/test_combiner.py              15-trial-per-scenario test of all 4 quadrants
  scripts/test_redteam.py               runs all red-team scenarios through the full pipeline
  llm/reason_vector.py                  Claude-generated rider-facing explanation for escalated sessions
  scripts/test_reason_vector.py         full pipeline -> reason vector, with/without a live API key
data/
  geolife/                 Microsoft GeoLife GPS trajectories (extracted, 182 users)
  odidmobtraj/              kept for reference only — no usable raw data
  hmog/                     put the extracted H-MOG dataset here once downloaded
```
