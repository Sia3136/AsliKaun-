# AsliKaun / Trust Juggler: Machine Learning, Biometrics & Defense Master Guide

> **Target Audience**: Hackathon Judges, Technical Evaluators, System Architects, and Viva Panels  
> **Core Focus**: End-to-end Machine Learning, Statistical Mechanics, Real Datasets, Scalability, Edge-Cases, and Defense Strategy.

---

## 1. Executive Summary & Problem Framing

### The Real-World Attack: Account Subleasing & Proxy Driving
In quick-commerce (Zepto, Blinkit, Zomato, Swiggy) and ride-hailing (Uber, Ola, Lyft):
1. **The Breach Point**: A verified driver passes initial facial verification (KYC/selfie) and OTP at 8:00 AM.
2. **The Handoff**: At 8:15 AM, they hand over their unlocked phone, vehicle, and gig worker account to an unvetted substitute driver (often someone banned, without a license, or working illegal split-shifts).
3. **The Failure of Existing Security**: Traditional identity solutions (IP tracking, device fingerprinting, GPS geolocation) are completely blind to this attack because the physical smartphone, SIM card, IP address, and login token have not changed.
4. **The Naive "Solution" That Fails**: Prompting random selfie checks while the driver is operating a two-wheeler causes fatal road accidents, high friction, and driver strikes.

### AsliKaun's Core Paradigm
**Continuous, passive, multi-modal behavioral biometric intelligence.** As the driver interacts with the app (accepting orders, scrolling route waypoints, holding the phone, accelerating), AsliKaun extracts subtle neuromotor, kinematic, and operational biometrics in real time to establish an unbreakable identity continuity mesh.

---

## 2. Research Papers & Academic Grounding

Our architecture builds upon published peer-reviewed research in continuous authentication, adapting it specifically to gig-economy operational constraints:

| Research Domain | Seminal Paper Reference | How We Leveraged & Adapted It |
|---|---|---|
| **Touch Dynamics** | *Sitová et al., "HMOG: New Behavioral Biometrics Dataset for Continuous Authentication of Smartphone Users", IEEE TIFS 2016.* | Extracted stroke-level kinematic features (curvature, velocity, pressure-area gradient). Proved that LSTM reconstruction fails on population data; replaced with a deep Triplet Loss GRU to construct person-discriminative embedding spaces. |
| **Motion & Gait Kinematics** | *Kwapisz et al., "Activity Recognition using Cell Phone Accelerometers", ACM SIGKDD Explorations 2011; Derawi et al., "Gait Recognition using Mobile Phones", IEEE 2010.* | Extracted 2.5-second sliding windows combining time-domain moments (variance, skewness, kurtosis) and frequency-domain features (FFT spectral energy, dominant frequency) to fingerprint how an individual holds and stabilizes their device. |
| **GPS Trajectory Modeling** | *Zheng et al., "GeoLife: A Collaborative Social Networking Service among User, Location and Trajectory", ACM SIGSPATIAL 2008.* | Formulated delivery-wave route directness, turn entropy, and speed variation. Applied physical outlier rejection filters ($v > 50\text{ m/s}$) to discard GPS hardware teleportation. |
| **Statistical Calibration & Fusion** | *Vovk et al., "Algorithmic Learning in a Random World" (Conformal Prediction); Fisher, R.A., "Statistical Methods for Research Workers" (Fisher's Combined Probability Test).* | Replaced naive heuristic score averaging with Conformal Calibration (mapping raw distance to valid empirical p-values) and Fisher's $\chi^2$ multi-signal fusion. |

---

## 3. Real Datasets Used & Preprocessing Pipelines

We rejected synthetic-only assumptions and validated our models on massive real-world sensor datasets:

```
                          DATASET FLOW
┌──────────────────────────────────────────────────────────────┐
│  H-MOG Dataset (100 Subjects)                                │
│  - 24 sessions per user (taps, keystrokes, gestures)        │
│  - 3-axis accelerometer + 3-axis gyroscope @ 100 Hz          │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
     Touch Triplet Model             Motion Kinematics Model
     (EER: 0.352 vs 0.408 baseline)  (EER: 0.277 vs 0.440 baseline)

┌──────────────────────────────────────────────────────────────┐
│  ODIDMob_Routes Dataset                                      │
│  - 828+ real Beijing delivery couriers (Feb 2020)            │
│  - 16,000+ real delivery waves with multi-stop waypoints     │
└──────────────┬───────────────────────────────────────────────┘
               ▼
     Delivery Wave Trajectory Classifier (Classical 23-dim)
```

### 1. H-MOG Dataset (Touch & Motion)
- **Scale**: 100 individuals performing standardized reading and navigation tasks on Android smartphones.
- **Sensors**: Raw capacitive touch coordinates $(x, y)$, contact pressure $P$, touch surface area $A$, timestamp $t$, alongside triaxial accelerometer $(a_x, a_y, a_z)$ and gyroscope $(g_x, g_y, g_z)$ sampled at 100 Hz.
- **Preprocessing & Cleaning**:
  - Built a fault-tolerant CSV reader (`ml/data/hmog_loader.py:read_hmog_csv`) that drops corrupt sensor rows without breaking sequence alignment.
  - Fixed multi-digit string session sorting (prevented `session_10` from sorting before `session_2`).
  - Pre-extracted 2.5-second non-overlapping windows with minimum variance floors to remove table-resting stillness.

### 2. ODIDMob_Routes Dataset (GPS Trajectory)
- **Scale**: 828 couriers completing over 16,000 multi-stop delivery waves in Beijing.
- **Feature Extraction**: 23-dimensional feature vectors per wave:
  - Leg distance, trip duration, average velocity, velocity variance.
  - Heading angle change rate (turn entropy).
  - Route directness ratio: $\frac{\text{Euclidean distance (start to finish)}}{\text{Total traveled odometer distance}}$.
- **Physical Feasibility Filter**: Enforces $v < 50\text{ m/s}$ (180 km/h) to discard urban GPS multipath reflections and sensor tunneling.

### 3. Microsoft GeoLife Dataset
- 182 users over 5 years. Used as an independent reference baseline to ensure urban mobility feature extractors generalize outside Beijing delivery fleets.

---

## 4. Signal Architecture & Mathematical Formulations

```mermaid
graph TD
    subgraph SENSORS["1. Client Telemetry (SDK)"]
        T["Touch Micro-Gestures (x,y,pressure,path)"]
        M["Motion Triaxial Kinematics (accel, gyro)"]
        O["Operational Reaction Latency (accept_ms)"]
        G["GPS Route Waypoints (lat, lng, speed)"]
    end

    subgraph MODELS["2. Biometric Model Encoders"]
        MT["Touch Triplet GRU (Embedding: 64-dim)"]
        MM["Motion Kinematics GRU / IsolationForest"]
        MO["Operational Latency IsolationForest"]
        MG["GPS Wave Trajectory Classifier"]
    end

    subgraph CALIBRATION["3. Conformal Calibration & Fusion"]
        CP["Conformal Scorer: raw_distance -> p-value"]
        FF["Fisher's Multi-Signal Fusion (Chi-Square)"]
    end

    subgraph DECISION["4. Two-Axis Decision Grid"]
        AX["Two-Axis Classifier (Context vs Behavior)"]
        LLM["Groq AI Engine (qwen3.8-27b)"]
        SG["Pause-Aware Safety Gate (Speed == 0 mph)"]
    end

    T --> MT
    M --> MM
    O --> MO
    G --> MG

    MT & MM & MO & MG --> CP
    CP --> FF
    FF --> AX
    AX -->|Speed > 2 mph| SG
    AX -->|Escalated| LLM
```

### Signal 1: Touch Dynamics (Deep Triplet GRU)
- **Why Classical Baseline Failed**: Mahalanobis distance failed completely (AUC 0.454 — worse than chance) because estimating a 59-dimensional covariance matrix from only 15–20 enrollment strokes leads to severe singularity and overfitting.
- **Why LSTM Autoencoder Failed**: Iteration 1 trained an LSTM reconstruction autoencoder pooled across 81 users (EER 0.481, AUC 0.505). Since all humans have biologically valid fingers, the autoencoder reconstructed impostor touches almost as well as genuine touches!
- **The Breakthrough — Triplet Loss GRU**: Iteration 2 trained a 2-layer Bidirectional GRU using Triplet Margin Loss:
  $$\mathcal{L}(a, p, n) = \max\left(0, \mathcal{D}(f(a), f(p)) - \mathcal{D}(f(a), f(n)) + \alpha\right)$$
  Where $a$ is the anchor stroke, $p$ is a positive stroke from the same driver, $n$ is a negative stroke from another courier, and $\alpha = 0.2$.
- **Validation**: Dropped EER from 0.408 down to **0.352** (AUC: 0.722), confirmed on a holdout pool of 20 fresh impostors (EER: 0.351).

### Signal 2: Motion Kinematics (Windowed Triplet GRU)
- **Feature Vector**: 42-dimensional vector per 2.5-second window:
  - 3-axis mean, standard deviation, variance, skewness, kurtosis.
  - Fast Fourier Transform (FFT) dominant peak frequency and spectral energy distribution.
- **Validation**: Achieved an EER of **0.277** — a **37% error reduction** over classical IsolationForest (0.440). This represents the strongest individual behavioral biometric signal in the entire system.

### Signal 3: Operational Latency & Dispatch Cadence
- **Feature Vector**: 3-dimensional vector measuring order offer display timestamp to acceptance click latency, diurnal dispatch hour, and battery drain rate.
- **Model**: Classical IsolationForest with contamination $\nu = 0.05$. Achieves an individual EER of **0.256**.

### Signal 4: GPS Delivery Wave Trajectory
- Evaluated on ODIDMob_Routes. The deep GRU encoder and classical IsolationForest landed within the statistical noise band on holdout sets (0.372 vs 0.427). We selected the classical model for production on engineering simplicity, low compute overhead, and interpretability grounds.

---

## 5. Statistical Rigor: Conformal Calibration & Fisher Fusion

### Why Naive Averaging is Fatal
Most hackathon projects compute:
$$\text{Anomaly} = \frac{\text{TouchScore} + \text{MotionScore} + \text{GPSScore}}{3}$$
This is fundamentally broken because raw model outputs have wildly different variance, scale, and non-linearities.

### Conformal Prediction (p-value Standardization)
For each signal $s$, we take a held-out calibration set $\mathcal{D}_{\text{cal}} = \{z_1, \dots, z_m\}$ of verified authentic sessions. Given a new test session $z_{\text{new}}$ with non-conformity score $\alpha_{\text{new}}$:
$$p_s = \frac{1 + \sum_{i=1}^m \mathbf{1}(\alpha_i \ge \alpha_{\text{new}})}{m + 1}$$
Under the null hypothesis ($H_0$: authentic driver), $p_s \sim \text{Uniform}(0, 1)$. If an impostor is driving, $p_s \to 0$.

### Fisher's Combined Probability Test
To fuse $k$ independent behavioral signals into a single unified behavioral statistic:
$$\chi^2 = -2 \sum_{i=1}^k \ln(p_i) \sim \chi^2(2k)$$
The cumulative p-value is:
$$p_{\text{fused}} = 1 - F_{\chi^2(2k)}\left(\chi^2\right)$$

### Fusion Proof: The Concrete Numbers
| Signal Configuration | Pooled EER | Pooled AUC | FRR @ FAR = 1% |
|---|---|---|---|
| Operational Alone | 0.256 | 0.805 | 0.930 |
| Motion Alone | 0.277 | 0.780 | 0.880 |
| Touch Alone | 0.352 | 0.722 | 0.810 |
| **Fisher Multi-Signal Fusion** | **0.158** | **0.921** | **0.575** |

> **Viva Takeaway**: Fusing multi-modal signals drops the Equal Error Rate from 0.27–0.35 down to **0.158** and drives AUC to **0.921**. This mathematical proof demonstrates why multi-modal fusion is mandatory for commercial viability.

### Missing-Signal Policy
If a driver is stationary indoors (no GPS movement) or not touching the screen:
- We **never impute synthetic or zero values**.
- The system reduces the degrees of freedom $2k$ in the $\chi^2$ distribution dynamically. If only Touch and Motion are available, $k=2$ and degrees of freedom = 4. The math remains statistically valid.

---

## 6. The Two-Axis Decision Grid & Threshold Tuning

Instead of an opaque 1D risk score, AsliKaun decomposes every verification into orthogonal axes:

$$\text{Context Continuity } (C_c) \in [0, 1] \quad \times \quad \text{Behavior Continuity } (C_b) \in [0, 1]$$

```
          1.0 ┌───────────────────────────────┬───────────────────────────────┐
              │                               │                               │
              │         LEGIT CHANGE          │            STABLE             │
              │   (New Phone / New City,      │    (All Signals Normal,       │
              │    Identical Biometrics)      │     Verified Authentic)       │
Behavior      │                               │                               │
Continuity    │   Action: Silent Rebaseline   │   Action: Continue (No modal) │
(Cb)      0.29├───────────────────────────────┼───────────────────────────────┤
              │                               │                               │
              │          AMBIGUOUS            │       HANDOFF SIGNATURE       │
              │   (Noisy Sensors / Low Light, │   (Same Phone / Same Account, │
              │    Degraded Telemetry)        │    DIFFERENT PERSON USING IT) │
              │                               │                               │
              │   Action: Step-up Check       │   Action: Challenge at Stop   │
          0.0 └───────────────────────────────┴───────────────────────────────┘
             0.0                             0.6                             1.0
                                Context Continuity (Cc)
```

### The $0.29$ Threshold Discovery
- A naive threshold of $0.6$ flags 60% of honest sessions because uniform p-values under $H_0$ have $P(p < 0.6) = 0.6$.
- A textbook significance level of $0.05$ catches $0\%$ of handoffs because single-session biometric EER is $\sim 0.25$.
- By executing an empirical ROC-operating search (`ml/scripts/evaluate_fusion.py`), we determined the mathematically optimal threshold: **$C_b = 0.29$**.

---

## 7. Operational Edge Cases & Policy Matrix

| Scenario | Context ($C_c$) | Behavior ($C_b$) | Quadrant | Action | Rationale |
|---|---|---|---|---|---|
| **Legitimate New Phone** | Changed ($<0.6$) | Stable ($\ge 0.29$) | `legit_change` | **Auto-Rebaseline** | Driver upgraded phone. Touch and motion match perfectly. Never punish an honest worker. |
| **Proxy Driver / Sublet** | Unchanged ($\ge 0.6$) | Changed ($<0.29$) | `handoff_signature` | **Challenge at Safe Pause** | Same phone, same SIM, but substitute driver is driving. High-confidence fraud. |
| **Driver Illness / Fatigue** | Unchanged ($\ge 0.6$) | Moderate ($0.20-0.28$) | `ambiguous` | **Step-Up Check** | Slower reaction time due to fatigue. Do not suspend; prompt lightweight verification. |
| **Cold Start (Session 0–14)** | N/A | Heuristic fallback | `stable` / `ambiguous` | **Collect Baseline** | Uses population conformal fallback until $N \ge 15$ sessions accumulate for individual model bundle. |
| **Bumpy Road / Potholes** | Unchanged | Spiky variance | Noise filter | **Filter Triggered** | Potholes cause high frequency vertical spikes ($a_z > 18\text{ m/s}^2$). The DSP bandpass filter discards road shock. |

---

## 8. Anti-Distraction Engine: Pause-Aware Safety Gate

### The Safety Dilemma
If a handoff is detected at 45 mph on a highway, popping up a selfie verification modal can cause a fatal crash.

### Our Solution (`safe_pause` logic in `ml_bridge.py`)
```python
if vehicle_speed_mph > 2.0:
    return {
        "decision": "continue",
        "safe_pause_info": {
            "status": "deferred_for_driver_safety",
            "current_speed_mph": vehicle_speed_mph,
            "resumption_trigger": "speed == 0.0 mph (traffic light or drop-off)"
        }
    }
```
1. **Deferred Execution**: The security escalation is queued in memory.
2. **Zero-Speed Trigger**: Only when the GPS/speedometer confirms $v = 0.0\text{ mph}$ for $\ge 3$ consecutive seconds (e.g. at a red light or customer pickup) does the app prompt verification.

---

## 9. AI Explainability: Groq LLM Reason Vector

Black-box scores ($p = 0.031$) cannot be defended in labor arbitration or driver grievance hearings.

### The Pipeline (`ml/llm/reason_vector.py`)
1. Escalated telemetry discrepancies are structured into a JSON payload:
   - Relative z-score of touch pressure ($+240\%$).
   - Order acceptance latency shift ($750\text{ ms} \to 3200\text{ ms}$).
   - Phone tilt angle delta ($38^\circ$).
2. Sent to **Groq Cloud API** (`qwen/qwen3.8-27b`, sub-second execution):
3. Returns a standardized 3-part Reason Vector:
   - **Summary**: Plain-language description for dispatchers.
   - **Primary Driver**: Specific sensor metric that breached confidence thresholds.
   - **Recommended Action**: Proportional escalation protocol.

#### Real Example Output
> *"Driver Rohan S. exhibited a 3.2x increase in order acceptance latency (3,200 ms vs baseline 780 ms) alongside an 84% reduction in swipe curvature and a 38-degree shift in phone holding tilt. Device ID and cellular subnet remained constant. Indicates phone was handed over to a stationary co-pilot."*

---

## 10. Multi-Session Drift & Red-Team Defense

### The "Boiling Frog" Attack (Slow Drift)
A sophisticated proxy driver slowly takes over the account over 60 sessions, changing touch habits by 1.5% per session to trick moving-average filters.

### Defense Mechanism (`ml/redteam/detectors.py`)
We deploy two parallel detectors:
1. **Fast-baseline EWMA** ($\alpha = 0.3$): Catches sudden single-session handoffs.
2. **Frozen-Anchor Cumulative Sum (CUSUM) Detector**:
   - The reference baseline is **frozen** to the initial 20 KYC-verified onboarding sessions.
   - Computes cumulative drift: $S_t = \max(0, S_{t-1} + (p_{\text{baseline}} - p_t) - k)$.
   - Catches slow-drift attackers with a **median latency of 37 sessions** across 15 synthetic attacker evaluations.

---

## 11. System Performance, Latency & Scaling Specs

| Metric | Measured Value | Production Architecture Benchmark |
|---|---|---|
| **Touch Model Inference** | **1.8 ms** | Ran on CPU via PyTorch optimized TorchScript |
| **Motion Model Inference** | **2.4 ms** | Windowed FFT + GRU forward pass |
| **Fisher Calibration & Combiner**| **0.3 ms** | Vectorized NumPy $\chi^2$ computation |
| **Total Backend Decision Latency**| **< 15 ms** | Sub-perceptual to mobile client |
| **Groq LLM Explanation Latency** | **450–850 ms** | Asynchronous execution (only on escalated sessions) |
| **Storage per Driver** | **~24 KB** | 64-dim centroid + threshold parameters (No raw video) |
| **Network Telemetry Payload** | **< 3.2 KB** | Compressed JSON sliding buffer every 15 seconds |

---

## 12. Anticipated Viva & Technical Q&A Defense

### Q1: "Touch biometrics depend on road conditions. How do you distinguish a pothole from a new driver?"
> **Answer**: "Road bumps manifest as high-frequency vertical acceleration spikes ($a_z$) across a few milliseconds. In contrast, an impostor exhibits a systematic shift in physical anatomy: hand size changes contact surface area ($A$), grip strength shifts resting touch pressure ($P$), and motor habits alter the angular curvature of swipes. Additionally, our multi-modal Fisher fusion requires joint anomalies across touch, motion, and reaction latency—a pothole never alters order acceptance latency."

### Q2: "What if the driver wears motorcycle gloves or applies a screen protector?"
> **Answer**: "Gloves alter capacitive surface area and pressure uniformly across all touches. This maps to the **Legit Change** quadrant: contextual telemetry shifts, but stroke trajectory curvature and reaction timing remain consistent. The system triggers an automatic re-baseline rather than a punitive suspension."

### Q3: "Why use GRU instead of a Transformer or LSTM for the touch encoder?"
> **Answer**: "Touch strokes are short sequential bursts (typically 10 to 50 coordinate samples). Transformers require quadratic self-attention compute and massive pretraining datasets that cause extreme overfitting on short stroke sequences. Standard LSTMs have 4 gate operations per cell; GRUs have 2 gates (reset and update), achieving identical representational capacity with 33% fewer parameters and sub-2ms inference on edge CPUs."

### Q4: "How does the system ensure GDPR and DPDP Act biometric privacy compliance?"
> **Answer**: "We do not store raw capacitive heatmaps, fingerprints, face videos, or raw audio. Micro-gestures are converted into non-invertible mathematical feature embeddings inside an ephemeral 15-second client buffer. Once the summary vector is computed, raw sensor coordinates are permanently flushed from memory. Even if the database were compromised, raw physical biometric reconstruction is mathematically impossible."

### Q5: "What prevents an attacker from recording and replaying the authentic driver's sensor packets?"
> **Answer**: "Replay attacks fail due to three cryptographic and physical layers:
> 1. Every telemetry packet includes an encrypted monotonic timestamp and cryptographic nonce signed with an ephemeral session key.
> 2. Operational latency requires dynamic reaction to unpredictable, randomized server events (order offers, routing recalculations).
> 3. Accelerometer telemetry must correlate with real-time GPS Doppler velocity vectors; pre-recorded stationary motion immediately produces a catastrophic mismatch against moving GPS telemetry."
