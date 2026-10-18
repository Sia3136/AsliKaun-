# Machine Learning Development Log — Trust Juggler ML

This log documents all machine learning models, statistical calibration methods, deep neural representations, adversarial red-teaming benchmarks, and production inference harnesses established in the `ml/` module.

---

## 1. Module Overview & Scientific Foundations
The `ml/` subsystem implements continuous multi-modal behavioral authentication for delivery riders. It addresses unauthorized account sharing and sub-leasing ("rentals") without intrusive face-scans while riding.

### Core Mathematical Formulations:
1. **Per-Rider Non-Conformity Scoring**:
   - Each rider's baseline model scores incoming session observations against their personal enrollment profile.
2. **Split-Conformal p-Value Calibration** (`ml/calibration/conformal.py`):
   - Rather than relying on uncalibrated raw anomaly scores, scores are mapped against a held-out calibration set to produce exact conformal p-values:
     $$p = \frac{1 + \sum_{i=1}^n \mathbb{I}(s_i \ge s_{\text{query}})}{n + 1}$$
   - Under the null hypothesis (the rider is the true account owner), $p \sim \text{Uniform}(0, 1)$, providing distribution-free statistical validity.
3. **Fisher's Method Multi-Modal Fusion** (`ml/combiner/fisher.py`):
   - Independent p-values across available modalities are fused via Fisher's omnibus test statistic:
     $$X^2 = -2 \sum_{k=1}^K \ln(p_k) \sim \chi^2(2K)$$
   - The upper-tail probability $\mathbb{P}(\chi^2 \ge X^2)$ yields the unified behavioral continuity score.
4. **Dual-Timescale Architecture**:
   - Compares current behavior against both a **fast adaptive baseline** (accommodates normal gradual habit drift) and a **frozen anchor baseline** (detects slow adversarial shift attacks).

---

## 2. Completed Milestones & Experimental Results

### A. Phase 1: Classical Baseline & Multi-Modal Fusion
- **Signal Modalities & Feature Extractors**:
  - **Operational Cadence** (`ml/scorers/operational.py`): Order acceptance latency (ms) and cyclical hour-of-day cosine/sine encoding.
  - **Motion Dynamics** (`ml/scorers/motion.py`): Accelerometer variance, jerk, and energy spectral density calibrated against the H-MOG benchmark dataset.
  - **Touch Gestures** (`ml/scorers/touch.py`): Swipe velocity, stroke length, curvature, and tap pressure.
  - **GPS Trajectory Geometry** (`ml/features/gps_odidmob.py`): Heading variance, speed variance, stops-per-km, and delivery wave bounding boxes from the ODIDMob courier dataset.
- **Phase 1 Benchmark Evaluation** (`ml/scripts/evaluate_fusion.py`):
  - Standalone signal EERs: Operational (0.320), Touch (0.408), GPS (0.397), Motion (0.440).
  - **Multi-Modal Fisher Fusion EER**: **0.158** (AUC: **0.893**).
  - *Finding*: Fusion of complementary, weakly-correlated biometrics significantly outperforms any individual mobile sensor alone.

### B. Phase 2: Deep Representation Learning Benchmarks
1. **Touch Autoencoder (LSTM)** (`ml/models/touch_autoencoder.py`):
   - *Architecture*: 2-layer LSTM reconstruction autoencoder trained on stroke trajectories.
   - *Outcome*: Failed (EER: 0.485).
   - *Key Learning*: A reconstruction loss objective minimizes general population stroke dynamics rather than distinguishing person-specific idiosyncrasies.
2. **Touch Triplet Encoder (GRU)** (`ml/models/touch_triplet_encoder.py`):
   - *Architecture*: 2-layer Bidirectional GRU with triplet margin loss ($d(a, p) - d(a, n) + \alpha$) trained on Kaggle with H-MOG trajectories.
   - *Outcome*: **Confirmed Winner**.
   - *Metrics*: EER dropped from 0.408 to **0.352**; AUC increased from 0.624 to **0.722**.
   - *Action*: Promoted to replace IsolationForest as the production touch model.
3. **GPS Triplet Encoder (GRU)** (`ml/models/gps_triplet_encoder.py`):
   - *Architecture*: 2-layer GRU with contrastive/triplet objective on ODIDMob delivery routes.
   - *Initial Evaluation*: Classical IsolationForest (0.397) vs GRU Triplet (0.433).

### C. Holdout Re-Validation
- Evaluated on fresh, non-overlapping cohorts to guard against overfitting to the initial 18-rider test set:
  - **GPS Holdout** (`ml/scripts/evaluate_gps_holdout.py`): Evaluated against 8 fresh targets and 10 fresh impostors. Result flipped: Triplet (0.372) vs Classical (0.427). The difference is within the sample noise band; classical model retained for GPS on engineering simplicity grounds.
  - **Touch Holdout** (`ml/scripts/evaluate_touch_holdout.py`): Evaluated against a 2x-larger holdout pool of 20 fresh impostors never seen during training or initial eval. **Confirmed winner**: Triplet EER **0.351** vs Classical 0.436.

### D. Production Inference Pipeline (`ml/inference/`)
- **`RiderModelBundle`** (`ml/inference/rider_model_bundle.py`):
  - Unified production entry point called by the backend service.
  - Methods:
    - `.fit(enroll_sessions, calib_sessions)`: Fits rider-specific models (IsolationForest for operational/motion/GPS, Triplet Encoder for touch) and calibrates conformal score distributions.
    - `.score(session)`: Computes conformal p-values, performs Fisher fusion, checks two-axis quadrants, and generates explainability outputs.
  - **Missing-Signal Policy**: Skips unobserved sensors cleanly without synthetic imputation.
- **`SchemaAdapters`** (`ml/inference/schema_adapters.py`):
  - Converts frozen JSON backend session schemas into numerical tensor inputs.

### E. Adversarial Red-Teaming Suite (`ml/redteam/`)
- Evaluated against 4 attacker archetypes and 2 honest rider traps (`ml/scripts/test_redteam.py`):
  1. **Lazy Renter** (abrupt full handoff): Caught immediately at session 0 with `handoff_signature`.
  2. **Slow Drift Renter** (boiling-frog gradual attack over 60 sessions): Fast baseline adapted, but the **frozen anchor caught the attacker at session 46**, validating the dual-timescale architecture.
  3. **Split-Shift Sharer** (morning owner / evening renter): Caught at session 1 via bimodal Gaussian Mixture Model time-of-day clustering (`split_rental_suspected: True`).
  4. **Honest Phone & City Change**: Accurately classified as `legit_change` without false escalations.
  5. **Honest Illness Recovery**: Behavior temporarily slows down while context remains verified; properly tracked without severe fraud penalties.

### F. Explainability Reason Vector (`ml/llm/reason_vector.py`)
- Generates plain-language auditor summaries and rider-facing notifications for challenged sessions.
- Directly references conformal p-values (e.g. *"Context continuity 1.0, behavior continuity 0.199. Most unusual signal: operational (p=0.048)"*).
- Includes deterministic template fallbacks when `ANTHROPIC_API_KEY` is not configured, guaranteeing system resilience.

---

## 3. File Inventory
- [`ml/models/touch_triplet_encoder.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/models/touch_triplet_encoder.py): Production winning GRU triplet encoder for touch gestures.
- [`ml/models/isolation_baseline.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/models/isolation_baseline.py): Classical Isolation Forest baseline.
- [`ml/combiner/two_axis.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/combiner/two_axis.py): Two-Axis decision engine.
- [`ml/combiner/fisher.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/combiner/fisher.py): Fisher's method conformal p-value fusion.
- [`ml/calibration/conformal.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/calibration/conformal.py): Split-conformal non-conformity p-value calibration.
- [`ml/inference/rider_model_bundle.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/inference/rider_model_bundle.py): Production inference orchestrator (`.fit()`, `.score()`).
- [`ml/inference/schema_adapters.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/inference/schema_adapters.py): Schema adaptation layer.
- [`ml/redteam/drift_adversary.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/redteam/drift_adversary.py): Adversarial simulation generators.
- [`ml/llm/reason_vector.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/llm/reason_vector.py): Explainability reason vector generator.
- [`ml/kaggle/train_touch_triplet_encoder.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/ml/kaggle/train_touch_triplet_encoder.py): Self-contained Kaggle GPU training script.

---

## 4. Verification & Script Status
- `python ml/scripts/test_inference_wiring.py`: **PASSED** (End-to-end fit and score verified).
- `python ml/scripts/test_combiner.py`: **PASSED** (Context vs behavior quadrant mapping verified).
- `python ml/scripts/test_scorers.py`: **PASSED** (Operational and touch anomaly separation verified).
- `python ml/scripts/test_redteam.py`: **PASSED** (All 4 threat models and drift scenarios caught).
- `python ml/scripts/test_reason_vector.py`: **PASSED** (Explanation generation and template fallbacks verified).
