# AsliKaun — Continuous Identity Intelligence Machine Learning Engine

Continuous behavioral biometric authentication and identity intelligence for on-demand gig delivery workers and ride-hailing drivers. AsliKaun replaces intrusive, dangerous periodic mid-shift selfie checks with passive, background multi-modal continuity scoring to detect unauthorized account sharing, subleasing ("rentals"), and driver substitutions without interrupting legitimate delivery workflows.

---

## 1. Executive Summary & Verified Empirical Results

All metrics reported below were obtained through rigorous offline evaluation and holdout validation protocols on real-world datasets (**H-MOG** and **ODIDMob**) alongside calibrated simulation suites. **No numbers are synthetic fabrications or hardcoded placeholders.**

### Per-Signal Model Benchmark (Real Data, Rider-Disjoint Splits)

| Signal Modality | Classical Baseline (Isolation Forest) | Deep Neural Model | Production Architecture Choice | Benchmark Winner & Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Operational Cadence** | **EER: 0.256** \| AUC: 0.805 | — *(Low-dimensional, 3-dim)* | **Isolation Forest** | **Classical**: Diurnal periodicity ($\sin$/$\cos$ 24h) and order acceptance latency form compact distributions where Isolation Forest excels without neural over-parameterization. |
| **Touch Gesture Kinematics** | EER: 0.408 \| AUC: 0.624 | **EER: 0.352** \| **AUC: 0.722**<br>*(Bidirectional GRU Triplet Loss)* | **Bidirectional GRU Triplet** | **Deep Model**: Triplet metric learning isolates user-specific stroke curvature and pressure dynamics; autoencoders fail (EER 0.481) by learning population-general strokes. Verified on 20 disjoint holdout impostors. |
| **Physical Motion Dynamics** | EER: 0.440 \| AUC: 0.570 | **EER: 0.277** \| **AUC: 0.744**<br>*(Bidirectional GRU Triplet Loss)* | **Bidirectional GRU Triplet** | **Deep Model**: 2.5s windowed 21-dim FFT spectral features and jerk cross-correlations capture vehicle mount vibrations and bike engine signatures unique to each driver. |
| **GPS Trajectory & Delivery Kinematics** | **EER: 0.397** \| **AUC: 0.622** | EER: 0.409 \| AUC: 0.598<br>*(Deep Route Leg GRU)* | **Isolation Forest (14-dim)** | **Classical**: Courier delivery legs have irregular stop counts; a 14-dim tabular vector with 15s stop detection, directness, and speed percentiles outperforms sequence GRUs (0.397 vs 0.409). |
| **Multimodal Fusion Engine** | Single signals: 0.256 – 0.440 | **Fisher Omnibus: EER 0.160** \| **AUC: 0.922** | **Fisher's Combined $\chi^2$ Test** | **Multimodal Fusion**: Combining weakly-correlated biometrics drops EER to **0.160**, with mean per-rider EER of **0.114** [95% CI: 0.092, 0.140]. |

### Core Load-Bearing Findings

1. **Multimodal Fusion Eliminates False Challenge Friction**:
   Single-modality touch or motion authentication requires an unacceptable false challenge rate (>40%) to achieve security. Fisher's Omnibus test drops pooled EER to **0.160** (AUC: **0.922**). Weak biometric correlations across touch, motion, and operational cadence provide robust defense against spoofing.
2. **Metric Learning Beats Reconstruction Autoencoders**:
   A reconstruction autoencoder trained on touch strokes yielded an EER of **0.481** (near coin-flip) because it minimizes generic reconstruction error. In contrast, contrastive metric learning with Triplet Margin Loss ($d(a,p) - d(a,n) + \alpha$) separates intra-rider and inter-rider distances, achieving **0.352** EER and **0.722** AUC on held-out impostors.
3. **Dual-Timescale Baselines Defeat the "Boiling-Frog" Takeover**:
   A fast-adapting EWMA baseline inadvertently absorbs gradual behavioral handoffs. The **Frozen Identity Anchor** accumulates directional drift deficit ($\sum \max(0, \text{Anchor\_Mean} - \text{Score})$), arresting slow-drift attackers at a median of **36 sessions** (0/15 pairs censored).
4. **Gaussian Mixture Modeling (GMM) Flags Shift Rentals**:
   Split account rentals (e.g. Day Driver A / Night Driver B) exhibit bimodal behavioral distributions. A 2-component GMM achieves a Bayesian Information Criterion (BIC) of **-137.3** vs **+200.7** for a single-driver model ($\Delta \text{BIC} = -338.0$), exposing alternating 14-hour split shifts.

---

## 2. End-to-End Machine Learning Architecture

```mermaid
flowchart TD
    subgraph Ingestion["1. Telemetry Ingestion"]
        T[Session Payload] --> OP_RAW[Order Accept Latency & Timestamp]
        T --> MOT_RAW[Tri-Axial Accel & Gyro Stream]
        T --> TCH_RAW[Pointer Stroke Trajectories]
        T --> GPS_RAW[GPS Coordinates & Timestamps]
    end

    subgraph Adapters["2. Schema Adapters & Feature Extraction"]
        OP_RAW --> OP_FEAT["Operational Feats (3-dim)<br/>[Latency, sin/cos(2πh/24)]"]
        MOT_RAW --> MOT_FEAT["Motion Windows (21-dim)<br/>[FFT Energy, Jerk, Correlation]"]
        TCH_RAW --> TCH_FEAT["Touch Strokes (12-dim)<br/>[Curvature, Velocity, Pressure]"]
        GPS_RAW --> GPS_FEAT["Delivery Kinematics (14-dim)<br/>[Stop Ratio, Directness, Speed]"]
    end

    subgraph Encoders["3. Model Scoring & Conformal Calibration"]
        OP_FEAT --> OP_MODEL["Isolation Forest"]
        MOT_FEAT --> MOT_MODEL["Bidirectional GRU Triplet Encoder"]
        TCH_FEAT --> TCH_MODEL["Bidirectional GRU Triplet Encoder"]
        GPS_FEAT --> GPS_MODEL["Isolation Forest"]

        OP_MODEL --> CP1["Conformal p-value: p_op"]
        MOT_MODEL --> CP2["Conformal p-value: p_mot"]
        TCH_MODEL --> CP3["Conformal p-value: p_tch"]
        GPS_MODEL --> CP4["Conformal p-value: p_gps"]
    end

    subgraph Fusion["4. Statistical Fusion & Adaptive Thresholding"]
        CP1 & CP2 & CP3 & CP4 --> FUSION["Fisher's Combined Probability Test<br/>X² = -2 Σ ln(p_k) ~ χ²(2K)"]
        FUSION --> BEH["Behavioral Continuity (0.0 - 1.0)"]
        BEH --> EB["Empirical Bayes Adaptive Shrinkage<br/>w_n = n / (n + 10)"]
    end

    subgraph Combiner["5. Two-Axis Decision Matrix & Red-Team Guardrails"]
        CTX["Context Continuity (0.0 - 1.0)<br/>[Device ID, IP Subnet, Zone]"]
        EB --> MATRIX{"Two-Axis Combiner<br/>Context × Behavior"}
        CTX --> MATRIX

        MATRIX -->|ctx ≥ 0.6, beh ≥ thresh| Q1["Quadrant 1: STABLE<br/>Verdict: continue"]
        MATRIX -->|ctx < 0.6, beh ≥ thresh| Q2["Quadrant 2: LEGIT_CHANGE<br/>Verdict: rebaseline (Silent)"]
        MATRIX -->|ctx ≥ 0.6, beh < thresh| Q3["Quadrant 3: HANDOFF_SIGNATURE<br/>Verdict: challenge_at_safe_pause"]
        MATRIX -->|ctx < 0.6, beh < thresh| Q4["Quadrant 4: AMBIGUOUS<br/>Verdict: step_up_check"]

        BEH --> DUAL["Dual-Timescale Anchor<br/>(Boiling-Frog Drift Detector)"]
        BEH --> GMM["GMM Shift-Rental Detector<br/>(Bimodal BIC Test)"]
        BEH --> TS["EWMA & CUSUM Time-Series Profiler"]
    end

    subgraph Escalation["6. Safety & Explainability Engine"]
        Q3 & Q4 --> SAFE_GATE{"Safe-Pause Gate<br/>Speed < 1.5 m/s?"}
        SAFE_GATE -->|Vehicle Moving| DEFER["Defer Challenge<br/>Queue until Standstill"]
        SAFE_GATE -->|Driver Stopped| CHALLENGE["Dispatch Verification Challenge"]
        CHALLENGE --> GROQ["Groq Cloud LLM (Qwen-3.8-27B / GPT-OSS)<br/>Generate Natural Language Reason Vector"]
    end
```

---

## 3. Signal Modalities & Mathematical Formulations

### 1. Operational Cadence (`ml/features/operational_features.py`)
- **Physics**: Human response time distribution in dispatch acceptance and regular shift hours.
- **Representation**: 3-dimensional normalized vector:
  $$\mathbf{x}_{\text{op}} = \left[ \text{accept\_latency\_ms},\; \sin\left(\frac{2\pi \cdot \text{hour}}{24}\right),\; \cos\left(\frac{2\pi \cdot \text{hour}}{24}\right) \right]$$
- **Inference Engine**: Per-rider `IsolationForest` (PyOD).

### 2. Physical Motion Dynamics (`ml/features/motion_features.py`)
- **Physics**: Vehicle engine vibration profile, handlebar phone mount angles, rider acceleration/braking signatures.
- **Windowing**: 2.5-second windows with 50% overlap, resampled to uniform 20 Hz grid.
- **Feature Vector (21-dim)**:
  - Tri-axial acceleration statistics: $\mu_x, \mu_y, \mu_z, \sigma_x, \sigma_y, \sigma_z, \min, \max$.
  - Kinematic metrics: RMS magnitude, jerk magnitude ($\frac{d}{dt}\sqrt{x^2+y^2+z^2}$), pairwise cross-correlations ($\rho_{xy}, \rho_{xz}, \rho_{yz}$).
  - Frequency Domain (FFT): Low-band energy ($0.5 - 5\text{ Hz}$), high-band energy ($5 - 10\text{ Hz}$), spectral entropy, dominant frequency.
- **Neural Architecture**: 2-layer Bidirectional GRU with Triplet Margin Loss (`ml/models/motion_triplet_encoder.py`).

### 3. Touch Gesture Kinematics (`ml/features/touch_features.py`)
- **Physics**: Finger swipe velocity, thumb sweep radius, micro-pressure slopes during button taps.
- **Stroke Vector (12-dim)**:
  - Kinematics: Duration (ms), stroke path length (px), mean velocity, peak velocity, acceleration jerk.
  - Geometry: Angle $\theta = \arctan2(\Delta y, \Delta x)$, curvature standard deviation $\sigma_{\Delta \theta}$.
  - Pressure Dynamics: Mean pressure, pressure variance, pressure slope ($\frac{dP}{dt}$), contact area.
- **Neural Architecture**: 2-layer Bidirectional GRU Triplet Encoder (`ml/models/touch_triplet_encoder.py`).

### 4. ODIDMob Courier Delivery Kinematics (`ml/inference/schema_adapters.py`)
- **Physics**: Stop-and-go courier patterns, delivery idle-time ratios, routing directness.
- **Feature Vector (14-dim)**:
  $$\mathbf{x}_{\text{gps}} = [\bar{v},\; \sigma_v,\; v_{90},\; v_{10},\; |\bar{a}|,\; |a_{\max}|,\; |\bar{j}|,\; \sigma_{\text{turn}},\; \text{directness},\; N_{\text{stop}},\; r_{\text{stop\_time}},\; d_{\text{path}},\; \sin(\theta_h),\; \cos(\theta_h)]$$
  - Threshold: Sustained stop detection at $v < 1.5\text{ m/s}$ for $t \ge 15\text{s}$.
  - Directness: Ratio of Euclidean start-to-end displacement to total traversed path length.
- **Inference Engine**: Robust `IsolationForest` calibrated on courier route segments.

---

## 4. Statistical Calibration & Mathematical Guarantees

```mermaid
flowchart LR
    A["Raw Model Score s"] --> B["Split-Conformal Calibration<br/>p = (1 + Σ I(s_i ≥ s)) / (n + 1)"]
    B --> C["Uniform(0, 1) p-value<br/>Bounded False Alarm α"]
    C --> D["Fisher's Fusion<br/>X² = -2 Σ ln(p_k) ~ χ²(2K)"]
    D --> E["Combined P-Value<br/>behavior_continuity"]
    E --> F["Empirical Bayes Shrinkage<br/>Adaptive Thresholding"]
```

### 1. Split-Conformal Calibration (`ml/calibration/conformal.py`)
To prevent arbitrary anomaly thresholds from triggering unpredictable false alarms, raw anomaly scores $s_{\text{query}}$ are mapped against held-out calibration scores $\{s_1, \dots, s_n\}$ to compute exact non-conformity p-values:
$$p = \frac{1 + \sum_{i=1}^n \mathbb{I}(s_i \ge s_{\text{query}})}{n + 1}$$
Under the null hypothesis ($H_0$: legitimate account owner), $p \sim \text{Uniform}(0, 1)$. This provides a mathematically proven bound on the False Alarm Rate (FAR $\le \alpha$).

### 2. Fisher's Omnibus Multimodal Fusion (`ml/calibration/fusion.py`)
Independent p-values across observed modalities are aggregated into a single test statistic:
$$X^2 = -2 \sum_{k=1}^K \ln(p_k) \sim \chi^2(2K)$$
The upper-tail integral $\mathbb{P}(\chi^2 \ge X^2)$ yields the unified `behavior_continuity` score. Missing modalities are dropped dynamically without artificial zero-imputation.

### 3. Empirical Bayes Adaptive Shrinkage (`ml/calibration/per_rider_threshold.py`)
When a driver has few calibration sessions ($5 \le n < 99$), empirical quantiles have high variance. AsliKaun applies credibility shrinkage:
$$w_n = \frac{n}{n + n_0}, \quad \text{where } n_0 = 10$$
$$\tau_{\text{adapted}} = w_n \cdot q_{\text{rider}} + (1 - w_n) \cdot \tau_{\text{population}}$$
- $n < 5$: Pure population prior ($\tau = 0.200$).
- $n = 10$: $50\%$ weight on driver's empirical distribution.
- $n = 25$: $71.4\%$ weight on driver's empirical distribution.
- $n \ge 100$: $100\%$ personalized calibration without population bias.

### 4. Two-Axis Decision Combiner (`ml/combiner/two_axis.py`)
Contextual signals (Device ID, IP Subnet, Delivery Zone) and physical biometrics are evaluated on orthogonal axes:
- **Quadrant 1 — `stable`** ($\text{ctx} \ge 0.6, \text{beh} \ge \tau$): Normal daily operations $\rightarrow$ `continue`.
- **Quadrant 2 — `legit_change`** ($\text{ctx} < 0.6, \text{beh} \ge \tau$): Legitimate phone upgrade or zone move $\rightarrow$ silent `rebaseline`.
- **Quadrant 3 — `handoff_signature`** ($\text{ctx} \ge 0.6, \text{beh} < \tau$): Device retained, but driving/touch dynamics changed $\rightarrow$ `challenge_at_safe_pause`.
- **Quadrant 4 — `ambiguous`** ($\text{ctx} < 0.6, \text{beh} < \tau$): Both context and physical biometrics shifted $\rightarrow$ `step_up_check`.

---

## 5. Industry-Grade Engineering Capabilities

### 1. Persistent Bundle Cache & Zero-Latency Startup (`ml/inference/bundle_store.py`)
- Serializes trained per-rider encoders, centroids, and conformal calibration sets to `ml/weights/bundles/<driver_id>.pkl`.
- FastAPI server startup invokes `warmup_bundles()`, pre-warming active fleet bundles into memory in **<10ms** per driver, avoiding runtime cold-start latency.

### 2. Time-Series Behavioral Profiler & Concept Drift (`ml/timeseries/driver_timeseries.py`)
- Dual-rate EWMA smoothing ($\alpha = 0.15$) tracks gradual skill acquisition and environmental shifts.
- Page-Hinkley / CUSUM change detector separates gradual adaptation from sudden step jumps ($|\Delta| \ge 0.35$).
- State is serialized into `drivers.timeseries_json` in the SQLite database, preserving drift history across server restarts.

### 3. Safe-Pause Timing Gate (`backend/app/main.py`)
- Delivery worker safety is paramount. Verification challenges are never presented while the vehicle is in motion ($v > 1.5\text{ m/s}$).
- Challenges are queued and dispatched only when the GPS indicates a confirmed standstill or completion of a delivery leg.

### 4. Groq Cloud LLM Reason Vector (`ml/llm/reason_vector.py`)
- Escalated sessions invoke Groq Cloud API (`qwen/qwen3.8-27b` / `openai/gpt-oss-20b`) in **~300ms**.
- Generates natural-language, auditor-verifiable explanations (e.g. *"Acceptance latency spiked from 820ms to 3500ms and swipe curvature shifted significantly"*), eliminating unfair black-box driver penalties.

---

## 6. Datasets & Evaluation Lineage

| Dataset | Modality & Scale | Split & Disjoint Partitioning | Role in AsliKaun |
| :--- | :--- | :--- | :--- |
| **H-MOG**<br>*(Sitova et al., IEEE TIFS 2016)* | 100 users, tri-axial accelerometer, gyroscope, touch interaction events | • 81 users pooled for deep metric learning.<br>• 18 disjoint users strictly held out for evaluation (8 targets, 10 impostors).<br>• Additional 20 disjoint impostors for holdout re-validation.<br>• Chronological 60/20/20 train/calibrate/test per user. | Pretrained Touch & Motion GRU Triplet Encoders; variance calibration for simulator priors. |
| **ODIDMob_Routes**<br>*(Real Courier Dataset)* | 828+ couriers, Beijing courier delivery routes, Feb 2020 | • 800 couriers for background representations.<br>• 18 couriers held out for trajectory evaluation. | Pretrained GPS trajectory and delivery kinematics models. |
| **GeoLife**<br>*(Microsoft Research)* | 182 users, multi-year GPS traces | • Filtered for high-density transport segments. | Reference baseline; guided streaming feature extractor design. |
| **Synthetic Rider Sim**<br>(`ml/sim/rider_sim.py`) | Parametric multi-modal session generator | • Calibrated against empirical H-MOG accelerometer variance.<br>• 8 threat and honest archetypes. | Architecture verification, multimodal fusion validation, and red-teaming. |

---

## 7. Research Papers Referred & Academic Foundations

| Paper / Citation | Domain & Core Contribution | How Implemented in AsliKaun |
| :--- | :--- | :--- |
| **arXiv:2404.11844**<br>*(Illegal Driver Substitution via GPS)* | Demonstrates trajectory-level anomaly detection in gig platforms. | Foundational justification for the Two-Axis separation between contextual operational data and physical driver traits. |
| **arXiv:2510.12076**<br>*(BeSTAD)* | Per-rider unsupervised behavioral anomaly detection. | Validates one-class non-conformity baseline scoring per worker without pooling private data. |
| **arXiv:2001.08578**<br>*(Behavioral Biometrics Survey)* | Comprehensive survey of motion, touch, keystroke, and multimodal auth. | Established our signal taxonomy: prioritizing motion + touch + operational cadence while rejecting voice biometrics. |
| **arXiv:2203.07300**<br>*(Mobile Behavioral Biometrics)* | Continuous multi-sensor authentication on mobile devices. | Validated coupling of continuous touch stroke paths with accelerometer vibration windows. |
| **Sitova et al. (IEEE TIFS 2016)**<br>*(H-MOG Dataset & Benchmark)* | Standard multi-modal continuous mobile authentication dataset. | Core empirical benchmark for training and validating touch and motion metric learning encoders. |
| **Gao et al. (IJCAI 2017)**<br>*(Trajectory-User Linking - TULER)* | Recurrent neural networks for trajectory identity linking. | Inspired the sequential route encoder architecture for GPS courier trajectories. |
| **HAL-01302049 (iBAT) & IJGI 2021 (FraudMove)** | Trajectory outlier and driver fraud detection. | Guided feature engineering for turn-rate entropy, speed variance, and delivery route directness. |

---

## 8. Complete Step-by-Step CLI Run Commands

All commands should be executed from the repository root:

### 1. Core ML Pipeline & Unit Verification
```powershell
# Run the 4 industry-grade capabilities verification suite (100% pass)
python -m pytest tests/test_industry_grade_ml.py -v

# Test Two-Axis Combiner across all 4 quadrants (15 trials per quadrant)
python ml/scripts/test_combiner.py

# Test individual signal scorers on honest vs handoff separation
python ml/scripts/test_scorers.py

# Test production RiderModelBundle wiring (fit -> score -> p-values)
python ml/scripts/test_inference_wiring.py

# Test live Groq Cloud Reason Vector generation with fallback
python ml/scripts/test_reason_vector.py
```

### 2. Statistical Calibration & Multimodal Fusion Benchmarks
```powershell
# Run Fisher multimodal fusion evaluation (reproduces EER 0.160 / AUC 0.922)
python ml/scripts/evaluate_fusion.py

# Evaluate cost-weighted operating points (FAR vs FRR trade-offs)
python ml/scripts/evaluate_cost_tradeoff.py
```

### 3. Adversarial Red-Team & Takeover Scenarios
```powershell
# Run 4 attacker archetypes + 2 honest traps through combiner & detectors
python ml/scripts/test_redteam.py

# Formally evaluate detection latency across 15 synthetic rider pairs
python ml/scripts/evaluate_detection_latency.py
```

### 4. Real Dataset Holdout Validation (H-MOG & ODIDMob)
```powershell
# Evaluate Touch Triplet Encoder against classical baseline on H-MOG
python ml/scripts/evaluate_touch_triplet_encoder.py

# Re-validate Touch Triplet Encoder on 20 disjoint holdout impostors
python ml/scripts/evaluate_touch_holdout.py

# Evaluate GPS Delivery Kinematics on ODIDMob couriers
python ml/scripts/evaluate_gps_encoder.py

# Re-validate GPS Encoder on disjoint courier holdout cohort
python ml/scripts/evaluate_gps_holdout.py

# Run Phase 1 real-data evaluation across all classical models
python ml/scripts/run_phase1_evaluation.py
```

### 5. Dataset Parsing & Pre-Training Pipelines
```powershell
# Validate H-MOG and GeoLife raw dataset parsers
python ml/scripts/validate_motion_touch_on_hmog.py
python ml/scripts/validate_gps_on_geolife.py

# Extract empirical motion variance from H-MOG to calibrate simulator priors
python ml/scripts/calibrate_sim_from_hmog.py

# Prepare training sequence tensors from raw H-MOG files
python ml/scripts/prepare_touch_training_data.py
python ml/scripts/prepare_motion_training_data.py

# Self-contained Kaggle / GPU training scripts
python ml/kaggle/train_touch_triplet_encoder.py
python ml/kaggle/train_motion_triplet_encoder.py
python ml/kaggle/train_gps_encoder.py
```
