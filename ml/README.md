# Trust Juggler / AsliKaun — Machine Learning Engine

Continuous behavioral biometric authentication and identity intelligence for gig delivery workers and ride-hailing drivers. Replaces intrusive periodic mid-shift face scans with background multi-modal continuity scoring to catch unauthorized account sharing, subleasing ("rentals"), and driver substitutions.

---

## 1. Executive Summary & Key Results

### Per-Signal Model Benchmark (Offline Evaluation, Real Data, Rider-Disjoint)

| Signal Modality | Classical Baseline (IsolationForest) | Deep Neural Model | Winner | Production Status |
| :--- | :---: | :---: | :---: | :--- |
| **Operational** | **EER: 0.256** \| AUC: 0.805 | — (Low-dim, not needed) | **Classical** | ✅ Active in live backend |
| **Touch Dynamics** | EER: 0.408 \| AUC: 0.624 | **EER: 0.352** \| AUC: **0.722**<br>(Bi-GRU Triplet Loss) | **Deep Model** | ✅ Active with continuous path telemetry |
| **Physical Motion** | EER: 0.440 \| AUC: 0.570 | **EER: 0.277** \| AUC: **0.744**<br>(Bi-GRU Triplet Loss) | **Deep Model** | ✅ Active with 2.5s windowed resampling |
| **GPS Trajectory** | EER: 0.397 (orig) / 0.427 (holdout) | **EER: 0.360** (holdout retrained)<br>(GRU Triplet Loss) | **Leaning Deep** | ⚠️ Active via 4-feature streaming stopgap |
| **Multimodal Fusion** | Standalone: 0.202 – 0.377 | **Fisher Omnibus: EER 0.160** \| **AUC: 0.922** | **Fisher Fusion** | ✅ Core architectural decision engine |

### Load-Bearing Findings
1. **Multimodal Fusion Outweighs Individual Signal Optimizations**: Combining weakly-correlated biometrics drops EER from 0.20–0.44 down to **0.160** (AUC: 0.922). Cost-model analysis reveals that single-modality touch authentication requires an 81% false-challenge rate to achieve high security, whereas Fisher fusion achieves high security with acceptable honest-worker friction.
2. **Triplet Metric Learning Beats Autoencoder Reconstruction**: A reconstruction autoencoder fails on touch dynamics (EER: 0.481 ≈ coin flip) because it minimizes population-general stroke deviations rather than person-specific traits. Recurrent metric learning with triplet margin loss ($d(a,p) - d(a,n) + \alpha$) isolates person-discriminative features and confirmed superiority on held-out impostor cohorts.
3. **Dual-Timescale Baseline Defeats the "Boiling-Frog" Attack**: A naive fast-adapting baseline (EWMA) absorbs gradual, linear behavioral handoffs. The Frozen Identity Anchor tracks cumulative drift and successfully halts slow-drift attackers at a median of **36 sessions**.

---

## 2. End-to-End ML Pipeline Architecture

```
                             [ INCOMING TELEMETRY SESSION ]
                   ┌─────────────────┬─────────────────┬─────────────────┐
                   │   Operational   │     Motion      │      Touch      │       GPS
                   │  (Latency, ms)  │ (3-Axis Accel)  │ (Path Gestures) │ (Speed, Heading)
                   └────────┬────────┴────────┬────────┴────────┬────────┴────────┬───────┘
                            │                 │                 │                 │
    [Schema Adapters]  3-dim Vector     21-dim Windows    12-dim Strokes      Trip Stats
                            │                 │                 │                 │
      [Model Scoring]  IsolationForest  GRU Triplet Loss  GRU Triplet Loss  IsolationForest
                            │                 │                 │                 │
 [Split-Conformal]     p_operational       p_motion          p_touch            p_gps
                            │                 │                 │                 │
                            └─────────────────┼─────────────────┴─────────────────┘
                                              ▼
                                  [ Fisher's Omnibus Fusion ]
                                  X² = -2 Σ ln(p_k) ~ χ²(2K)
                                              │
                                              ▼
                                    behavior_continuity (0 to 1)
                                              │
        [ Context Verification ] ─────────────┼───────────────────────────┐
     (Device ID, IP Subnet, Zone)             │                           │
                   │                          ▼                           ▼
            context_continuity       [ TWO-AXIS COMBINER ]     [ DUAL-TIMESCALE ANCHOR ]
                                     Context × Behavior        Frozen Anchor Cumulative Drift
                                              │                (Catches slow boiling-frog handoffs)
                                              ▼
                                  4-Quadrant Decision Matrix:
                       • stable             → continue
                       • legit_change       → silent re-baseline
                       • handoff_signature  → challenge at safe pause
                       • ambiguous          → step-up check
                                              │
                                              ▼ (if escalated)
                               [ Plain-Language Reason Vector ]
                                Groq / Claude LLM Explanation
```

---

## 3. Signal Modalities & Feature Engineering

### 1. Operational Cadence (`ml/features/operational_features.py`)
- **Physics**: Order dispatch acceptance latency and shift hours.
- **Representation**: 3-dimensional vector:
  $$\mathbf{x}_{\text{op}} = [\text{accept\_latency\_ms},\; \sin(2\pi \cdot \text{hour}/24),\; \cos(2\pi \cdot \text{hour}/24)]$$
- **Model**: Per-rider `IsolationForest` (PyOD).

### 2. Physical Motion Dynamics (`ml/features/motion_features.py`)
- **Physics**: Bike engine vibrations, phone mount angles, rider acceleration/braking signatures.
- **Windowing**: 2.5-second windows with 50% overlap, resampled to uniform 20 Hz grid.
- **Window Vector (21-dim)**:
  - Tri-axial stats: Mean, standard deviation, min, max per axis ($x, y, z$).
  - Kinematics: RMS magnitude, jerk magnitude ($\frac{d}{dt}\sqrt{x^2+y^2+z^2}$), axis cross-correlations ($\rho_{xy}, \rho_{xz}, \rho_{yz}$).
  - Frequency Domain (FFT): Low-band energy ($0.5 - 5\text{ Hz}$), high-band energy ($5 - 10\text{ Hz}$), spectral entropy, dominant frequency.
- **Model**: 2-layer Bidirectional GRU Triplet Encoder (`ml/models/motion_triplet_encoder.py`).

### 3. Touch Gesture Kinematics (`ml/features/touch_features.py`)
- **Physics**: Swipe speed, thumb curvature, micro-pressure slopes on confirmation buttons.
- **Stroke Vector (12-dim)**:
  - Kinematics: Duration (ms), stroke path length (px), mean velocity, peak velocity, acceleration jerk.
  - Geometry: Angle $\theta = \arctan2(\Delta y, \Delta x)$, curvature standard deviation $\sigma_{\Delta \theta}$.
  - Dynamics: Mean pressure, pressure variance, pressure slope ($\frac{dP}{dt}$), mean contact area.
- **Model**: 2-layer Bidirectional GRU Triplet Encoder (`ml/models/touch_triplet_encoder.py`).

### 4. Macro GPS Trajectory Geometry (`ml/features/gps_features.py`)
- **Physics**: Routing directness, speed histograms, turn frequencies.
- **Features**: 23-dim per-delivery wave summary (ODIDMob) and 4-dim streaming stats (GeoLife-style speed mean, turn rate, stop frequency).
- **Model**: GRU Triplet Encoder and Isolation Forest baseline.

---

## 4. Datasets & Evaluation Protocol

| Dataset | Modality & Scale | Split & Leakage Discipline | Usage in Pipeline |
| :--- | :--- | :--- | :--- |
| **H-MOG**<br>(Sitova et al.) | 100 users, tri-axial accelerometer, gyroscope, touch interaction events | • 81 users pooled for deep metric learning training.<br>• 18 users strictly held out for evaluation (8 targets, 10 impostors).<br>• Additional 20 disjoint impostors for holdout re-validation.<br>• Chronological 60/20/20 train/calibrate/test per user. | Pretrained Touch & Motion GRU Triplet Encoders; variance calibration for simulator. |
| **ODIDMob_Routes**<br>(Real courier data) | 828+ couriers, Beijing courier delivery routes, Feb 2020 | • 800 couriers for GRU contrastive training.<br>• 18 couriers held out for trajectory evaluation. | Pretrained GPS trajectory models. |
| **GeoLife**<br>(Microsoft Research) | 182 users, multi-year GPS traces | • Filtered for high-density transport segments. | Reference baseline; informed live streaming feature extractor. |
| **Synthetic Rider Sim**<br>(`ml/sim/rider_sim.py`) | Synthetic multi-modal session generator | • Calibrated against empirical H-MOG accelerometer variance.<br>• 8 threat and honest archetypes. | Architecture verification, multimodal fusion validation, and red-teaming. |

---

## 5. Statistical Calibration & Decision Intelligence

### Split-Conformal Calibration (`ml/calibration/conformal.py`)
To prevent arbitrary anomaly score cutoffs from triggering erratic false alarms, scores are mapped against held-out calibration sessions to generate exact p-values:
$$p = \frac{1 + \sum_{i=1}^n \mathbb{I}(s_i \ge s_{\text{query}})}{n + 1}$$
Under the null hypothesis ($H_0$: legitimate account owner), $p \sim \text{Uniform}(0, 1)$, establishing mathematical guarantees on false-alarm bounds.

### Fisher's Omnibus Multimodal Fusion (`ml/calibration/fusion.py`)
Independent p-values across observed modalities are fused via Fisher's combined probability test:
$$X^2 = -2 \sum_{k=1}^K \ln(p_k) \sim \chi^2(2K)$$
The upper-tail integral $\mathbb{P}(\chi^2 \ge X^2)$ yields the unified `behavior_continuity` score. Missing signals are dropped cleanly without zero-imputation.

### Two-Axis Decision Engine (`ml/combiner/two_axis.py`)
Separates Context Continuity (Device ID, IP Subnet, Delivery Zone) from Behavioral Continuity:
- `stable` ($\text{ctx} \ge 0.6, \text{beh} \ge 0.29$): Standard normal operation $\rightarrow$ `continue`.
- `legit_change` ($\text{ctx} < 0.6, \text{beh} \ge 0.29$): New device or relocated zone, verified behavior $\rightarrow$ silent `rebaseline`.
- `handoff_signature` ($\text{ctx} \ge 0.6, \text{beh} < 0.29$): Same device, anomalous physical signature $\rightarrow$ `challenge_at_safe_pause`.
- `ambiguous` ($\text{ctx} < 0.6, \text{beh} < 0.29$): Context and behavior both disrupted $\rightarrow$ `step_up_check`.

### Dual-Timescale Baselines (`ml/redteam/detectors.py`)
- **Fast Adaptive Baseline (EWMA)**: Tracks natural gradual habit changes.
- **Frozen Anchor Baseline**: Fixed to the initial verified enrollment profile. It integrates cumulative behavioral deficit:
  $$\text{Deficit} = \sum \max(0, \text{Anchor\_Mean} - \text{behavior\_score})$$
  Halts slow-drift "boiling-frog" adversaries at session 36.

### Split-Rental Mixture Clustering (`ml/redteam/detectors.py`)
Fits a 2-component Gaussian Mixture Model (GMM) on session biometrics across time. Identifies alternating bimodal distributions where cluster components correlate with time of day (morning owner / evening renter).

---

## 6. Research Papers Referred & Academic Foundations

| Citation / Reference | Domain & Contribution | How Used in Trust Juggler |
| :--- | :--- | :--- |
| **arXiv:2404.11844**<br>*(Illegal Driver Substitution via GPS)* | Identifies trajectory-level anomalies in gig platforms. | Foundational justification for two-axis separation between contextual operational data and physical driver traits. |
| **arXiv:2510.12076**<br>*(BeSTAD)* | Per-rider unsupervised behavioral anomaly detection. | Validates one-class non-conformity baseline scoring per worker. |
| **arXiv:2001.08578**<br>*(140+ Behavioral Biometrics Survey)* | Comprehensive review of motion, touch, keystroke, and multimodal authentication. | Established the signal taxonomy: prioritizing motion + touch + operational cadence while discarding voice. |
| **arXiv:2203.07300**<br>*(Mobile Behavioral Biometrics)* | Continuous multi-sensor authentication on mobile devices. | Validated coupling of continuous touch stroke paths with accelerometer vibration windows. |
| **Sitova et al. (IEEE TIFS 2016)**<br>*(H-MOG Dataset & Benchmark)* | Standard multi-modal continuous mobile authentication dataset. | Core empirical benchmark for training and validating touch and motion metric learning encoders. |
| **Gao et al. (IJCAI 2017)**<br>*(Trajectory-User Linking - TULER)* | Recurrent neural networks for trajectory identity linking. | Inspired the GRU sequential route encoder for GPS courier trajectories. |
| **HAL-01302049 (iBAT) & IJGI 2021 (FraudMove)** | Trajectory outlier and driver fraud detection. | Guided feature engineering for turn-rate entropy, speed variance, and route directness. |

---

## 7. Production Inference Wiring (`ml/inference/`)

- **`RiderModelBundle`** (`ml/inference/rider_model_bundle.py`):
  - `.fit(enroll_sessions, calib_sessions)`: Fits per-rider Isolation Forest models and deep encoder centroids, computing empirical conformal calibration distributions.
  - `.score(session)`: Computes conformal p-values, performs Fisher fusion, checks two-axis quadrants, and generates explainability outputs.
  - **In-Memory Cache**: Cached in the backend (`_BUNDLE_CACHE`) and refit periodically rather than per HTTP request.
- **`SchemaAdapters`** (`ml/inference/schema_adapters.py`):
  - Adapts incoming JSON payloads into numerical tensors, parsing continuous pointer trajectories (`touch_events[].path`) and windowed acceleration.
- **LLM Reason Vectors** (`ml/llm/reason_vector.py`):
  - Translates conformal p-values into plain-English auditor explanations via Groq (`openai/gpt-oss-20b` / `qwen/qwen3.8-27b`) or Claude, with structured template fallbacks.
- **Step-Up Verification** (`ml/models/face_verification.py`):
  - Pretrained FaceNet (`InceptionResnetV1` on VGGFace2) + MTCNN face alignment for selfie challenge verification.

---

## 8. Complete Step-by-Step Run Commands

All commands should be executed from the repository root:

```bash
# -------------------------------------------------------------------
# 1. CORE PIPELINE & ARCHITECTURE TESTS
# -------------------------------------------------------------------

# Test Two-Axis Combiner across all 4 quadrants (15 trials per quadrant)
python ml/scripts/test_combiner.py

# Test individual signal scorers on honest vs handoff separation
python ml/scripts/test_scorers.py

# Test production RiderModelBundle wiring (fit -> score -> p-values)
python ml/scripts/test_inference_wiring.py

# Test LLM Reason Vector generation (Groq / Claude / template fallback)
python ml/scripts/test_reason_vector.py


# -------------------------------------------------------------------
# 2. ADVERSARIAL RED-TEAM BENCHMARKS
# -------------------------------------------------------------------

# Run 4 attacker archetypes + 2 honest traps through combiner & detectors
python ml/scripts/test_redteam.py

# Formally evaluate detection latency across 15 synthetic rider pairs
python ml/scripts/evaluate_detection_latency.py


# -------------------------------------------------------------------
# 3. STATISTICAL CALIBRATION & FUSION EVALUATION
# -------------------------------------------------------------------

# Verify multimodal Fisher fusion vs single-signal EER & AUC
python ml/scripts/evaluate_fusion.py

# Evaluate cost-weighted operating points (FAR vs FRR trade-offs)
python ml/scripts/evaluate_cost_tradeoff.py


# -------------------------------------------------------------------
# 4. REAL DATASET EVALUATION & HOLD-OUT VALIDATION
# -------------------------------------------------------------------

# Run Phase 1 real-data evaluation (H-MOG + ODIDMob) across classical models
python ml/scripts/run_phase1_evaluation.py

# Evaluate Touch Triplet Encoder against classical baseline on H-MOG
python ml/scripts/evaluate_touch_triplet_encoder.py

# Re-validate Touch Triplet Encoder on 2x-larger holdout pool (20 impostors)
python ml/scripts/evaluate_touch_holdout.py

# Evaluate GPS Encoder against classical baseline on ODIDMob routes
python ml/scripts/evaluate_gps_encoder.py

# Re-validate GPS Encoder on disjoint holdout cohort
python ml/scripts/evaluate_gps_holdout.py


# -------------------------------------------------------------------
# 5. DATASET PARSING & RE-TRAINING (KAGGLE / GPU)
# -------------------------------------------------------------------

# Validate H-MOG and GeoLife parsers
python ml/scripts/validate_motion_touch_on_hmog.py
python ml/scripts/validate_gps_on_geolife.py

# Extract motion variance from H-MOG to calibrate simulator priors
python ml/scripts/calibrate_sim_from_hmog.py

# Prepare training sequences from raw H-MOG files
python ml/scripts/prepare_touch_training_data.py
python ml/scripts/prepare_motion_training_data.py

# Self-contained Kaggle GPU training scripts
python ml/kaggle/train_touch_triplet_encoder.py
python ml/kaggle/train_motion_triplet_encoder.py
python ml/kaggle/train_gps_encoder.py
```
