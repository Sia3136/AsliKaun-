import React, { useEffect, useRef } from 'react';

interface ArchitectureCardData {
  tag: string;
  title: string;
  desc: string;
  badge: string;
  telemetry: string;
  renderVisual: () => React.ReactNode;
}

export const ArchitectureStack: React.FC = () => {
  const cardsRef = useRef<(HTMLElement | null)[]>([]);

  const ARCHITECTURE_CARDS: ArchitectureCardData[] = [
    {
      tag: '01 / TWO-AXIS COMBINER',
      title: 'Dual-Axis Trust Assessment',
      desc: 'Separates hardware and network signals from physical motor biometrics, ensuring a new phone or changed cellular tower never gets mistaken for an illegal account handoff.',
      badge: 'CONTEXT × BEHAVIOR MATRIX',
      telemetry: 'Contextual Continuity (X) vs Physical Biometrics (Y)',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#38bdf8' }}>// TWO-AXIS SCATTER EVAL</span>
            <span style={{ color: '#10b981' }}>Fisher Combined χ²</span>
          </div>
          {/* Matrix Visual */}
          <div style={{ position: 'relative', height: '170px', borderLeft: '1px solid rgba(255,255,255,0.15)', borderBottom: '1px solid rgba(255,255,255,0.15)', margin: '8px 4px 4px 18px' }}>
            {/* Quadrant lines */}
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            {/* Labels */}
            <span style={{ position: 'absolute', top: '8px', left: '8px', color: '#38bdf8', fontSize: '9px' }}>LEGIT CHANGE<br/><span style={{ color: '#64748b' }}>Silent rebaseline</span></span>
            <span style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981', fontSize: '9px' }}>STABLE IDENTITY<br/><span style={{ color: '#64748b' }}>Verified continuous</span></span>
            <span style={{ position: 'absolute', bottom: '8px', left: '8px', color: '#f59e0b', fontSize: '9px' }}>AMBIGUOUS<br/><span style={{ color: '#64748b' }}>Multi-factor variance</span></span>
            <span style={{ position: 'absolute', bottom: '8px', right: '8px', color: '#ef4444', fontSize: '9px' }}>HANDOFF SIGNATURE<br/><span style={{ color: '#ef4444' }}>Same phone, new human</span></span>
            {/* Simulated Points */}
            <div style={{ position: 'absolute', right: '28%', top: '22%', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} title="Stable Session" />
            <div style={{ position: 'absolute', left: '24%', top: '26%', width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8' }} title="New Phone, Same Driver" />
            <div style={{ position: 'absolute', right: '22%', bottom: '24%', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 14px #ef4444', animation: 'pulse 1.8s infinite' }} title="Handoff Detected!" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
            <span>← Context Continuity (C_ctx) →</span>
            <span>Threshold: C_b = 0.29</span>
          </div>
        </div>
      ),
    },
    {
      tag: '02 / TEMPORAL MODELING',
      title: 'Dual-Timescale Baselines',
      desc: 'Defeats slow "boiling frog" account subleases where an impostor takes over gradually across weeks. The Frozen Anchor catches slow drift that fast-adapting baselines miss.',
      badge: 'FROZEN ANCHOR VS FAST EWMA',
      telemetry: 'Median Detection: 36 Sessions · Zero Censored Pairs',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#38bdf8' }}>// BOILING-FROG DRIFT DETECTOR</span>
            <span style={{ color: '#ef4444' }}>Deficit Breach @ Session 27</span>
          </div>
          {/* Dual curve SVG */}
          <div style={{ position: 'relative', height: '160px', width: '100%', display: 'flex', alignItems: 'center' }}>
            <svg width="100%" height="140" viewBox="0 0 320 140" style={{ overflow: 'visible' }}>
              {/* Gridlines */}
              <line x1="0" y1="20" x2="320" y2="20" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="70" x2="320" y2="70" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="120" x2="320" y2="120" stroke="rgba(255,255,255,0.05)" />
              {/* Frozen Anchor Line (Flat solid blue) */}
              <line x1="0" y1="35" x2="320" y2="35" stroke="#38bdf8" strokeWidth="2.5" />
              <text x="6" y="28" fill="#38bdf8" fontSize="9">Frozen Anchor (Verified At Onboarding)</text>
              {/* Slow Drift EWMA (Decaying curve) */}
              <path d="M 0 35 Q 120 42 200 85 T 320 120" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="5 4" />
              <text x="120" y="70" fill="#06b6d4" fontSize="9">Fast EWMA (Slowly Hijacked)</text>
              {/* Breach Marker */}
              <circle cx="240" cy="98" r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              <line x1="240" y1="35" x2="240" y2="98" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
              <text x="210" y="125" fill="#ef4444" fontSize="9" fontWeight="bold">Breach Flagged</text>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
            <span>Anchor: Verified Onboarding Profile</span>
            <span style={{ color: '#ef4444' }}>Cumulative Gap &gt; Threshold</span>
          </div>
        </div>
      ),
    },
    {
      tag: '03 / SAFETY INTERLOCK',
      title: 'Pause-Aware Safety Gate',
      desc: 'Never distracts a rider during active transit. If a handoff anomaly is detected while the motorcycle is traveling at speed, the verification challenge is held in queue until a verified standstill.',
      badge: 'SAFE-PAUSE PROTOCOL',
      telemetry: 'Zero Mid-Ride Popups · Dispatched only at 0.0 mph',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#f59e0b' }}>// SAFETY TIMING INTERLOCK</span>
            <span style={{ color: '#38bdf8' }}>GPS Speed: 18.4 mph</span>
          </div>
          {/* Safety Status Cockpit */}
          <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', margin: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 'bold' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
              CHALLENGE ARMED &amp; DEFERRED
            </div>
            <p style={{ margin: '8px 0 0', color: '#cbd5e1', fontSize: '11px', lineHeight: 1.5 }}>
              Active speed <b style={{ color: '#f8fafc' }}>18.4 mph</b> detected. Verification challenge safely suppressed to prevent traffic collision. Will trigger immediately upon delivery stop (speed = 0.0 mph).
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#64748b', fontSize: '9px' }}>TRANSIT STATE</span>
              <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>Active Moving</div>
            </div>
            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#64748b', fontSize: '9px' }}>CHALLENGE GATE</span>
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>Standstill (0 mph)</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      tag: '04 / EXPLAINABILITY',
      title: 'Groq LLM Reason Vectors',
      desc: 'Replaces cryptic, uninterpretable probability scores with transparent natural-language factor attributions. Operators and riders understand exactly which physical signals triggered an inquiry.',
      badge: 'GROQ CLOUD QWEN-3.8-27B',
      telemetry: 'Plain Language Attributions · Sub-Second Inference',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#10b981' }}>// REASON VECTOR INFERENCE</span>
            <span style={{ color: '#38bdf8' }}>Provider: Groq Cloud</span>
          </div>
          {/* Signal Bars */}
          <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#ef4444' }}>Touch Biometrics (Triplet GRU)</span>
                <span style={{ color: '#ef4444' }}>p = 0.012 (Anomaly)</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ width: '18%', height: '100%', background: '#ef4444' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#ef4444' }}>Acceptance Latency</span>
                <span style={{ color: '#ef4444' }}>p = 0.018 (3× normal)</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ width: '14%', height: '100%', background: '#ef4444' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#10b981' }}>GPS Courier Route</span>
                <span style={{ color: '#10b981' }}>p = 0.820 (Nominal)</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div style={{ width: '82%', height: '100%', background: '#10b981' }} />
              </div>
            </div>
          </div>
          {/* Reason Vector Card */}
          <div style={{ padding: '8px 10px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', fontSize: '10.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
            <b style={{ color: '#10b981' }}>Generated Explanation: </b>
            Touch swipe pressure spiked 3.2× while acceptance latency tripled. Route matches calibrated corridor, indicating a likely physical handoff.
          </div>
        </div>
      ),
    },
    {
      tag: '05 / FRICTION REDUCTION',
      title: 'Legitimate-Change Awareness',
      desc: 'Seamlessly accommodates new phone upgrades, cellular network switches, and travel relocation without blocking genuine delivery drivers.',
      badge: 'SILENT RE-BASELINE PROTOCOL',
      telemetry: 'Zero False Interruption on Genuine Hardware Upgrades',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#38bdf8' }}>// HARDWARE SHIFT ADAPTATION</span>
            <span style={{ color: '#10b981' }}>No Trip Interruption</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' }}>
            <div style={{ padding: '10px', background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                <span>Device Transition:</span>
                <span style={{ color: '#94a3b8' }}>Samsung A54 → Pixel 8</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', marginTop: '4px' }}>
                <span>Physical Biometrics:</span>
                <b>96% Historical Match</b>
              </div>
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '6px', color: '#10b981', fontSize: '10px' }}>
              ✓ ACTION: Silent Context Re-baseline triggered. Driver proceeds with scheduled delivery orders uninterrupted.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
            <span>Context Axis: Shifted</span>
            <span>Behavior Axis: Verified Stable</span>
          </div>
        </div>
      ),
    },
    {
      tag: '06 / ETHICAL GOVERNANCE',
      title: 'Privacy-Conscious On-Device Vault',
      desc: 'Raw accelerometer streams and screen tap recordings never leave the rider device. Only low-dimensional embeddings and statistical conformal p-values are transmitted.',
      badge: 'EDGE-PRESERVING EMBEDDINGS',
      telemetry: 'Differential Privacy Bounds · Full Driver Audit Trail',
      renderVisual: () => (
        <div style={{ width: '100%', height: '100%', background: '#0a0d16', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ color: '#10b981' }}>// ZERO-RAW-STORAGE PRIVACY</span>
            <span style={{ color: '#38bdf8' }}>Local Bi-GRU Encoder</span>
          </div>
          <div style={{ margin: '10px 0', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
            <div style={{ color: '#f8fafc', fontWeight: 'bold', marginBottom: '6px' }}>On-Device Telemetry Hygiene:</div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8', fontSize: '10.5px', lineHeight: 1.6 }}>
              <li>No raw sensor logs stored on server</li>
              <li>Touch curvature projected into 12-dim embedding</li>
              <li>Motor vibrations projected into 21-dim FFT vector</li>
              <li>Automatic 30-day raw purge policy</li>
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#10b981' }}>
            <span>✓ Encrypted Device Vault</span>
            <span>✓ Audit Appeal Ready</span>
          </div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const onScroll = () => {
      const vh = window.innerHeight;
      const elements = cardsRef.current.filter(Boolean) as HTMLElement[];

      elements.forEach((c, i) => {
        const nx = elements[i + 1];
        const ov = c.querySelector<HTMLElement>('.ov');
        if (!nx) return;

        const top = 0.1 * vh + i * 15;
        const nt = nx.getBoundingClientRect().top;
        const q = clamp((vh * 0.9 - nt) / (vh * 0.9 - (top + 15)), 0, 1);
        const depth = elements.length - i;

        c.style.transform = `scale(${1 - q * 0.03 * depth})`;
        if (ov) {
          ov.style.opacity = `${q * 0.55}`;
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
        });
      },
      { threshold: 0.35 }
    );

    cardsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="how" id="pipeline">
      <div className="wrap">
        <header>
          <span className="pill">
            <i />CONTINUOUS ARCHITECTURE
          </span>
          <h2>Engineered for Deep Telemetry Continuity</h2>
          <p className="section-desc">
            Six synchronized architectural layers evaluating contextual and behavioral signals to detect account handoffs with explainable accuracy.
          </p>
        </header>

        <div id="steps">
          {ARCHITECTURE_CARDS.map((card, i) => (
            <article
              key={card.tag}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              data-index={i}
              className="sc"
              style={{ '--i': i } as React.CSSProperties}
            >
              <div className="cp">
                <span className="n">{card.tag}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <div className="sc-telemetry-chip">
                  <span>{card.telemetry}</span>
                </div>
              </div>

              <div className="vp">
                <div className="vp-img-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
                  {card.renderVisual()}
                  <div className="vp-badge-overlay">
                    <span className="vp-badge">{card.badge}</span>
                  </div>
                </div>
              </div>

              <div className="ov" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
