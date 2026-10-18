import React, { useEffect, useRef } from 'react';

interface ApproachPillar {
  num: string;
  tag: string;
  title: string;
  desc: string;
  chip: string;
}

const PILLARS: ApproachPillar[] = [
  {
    num: '01',
    tag: 'CONTEXT',
    title: 'Contextual Continuity',
    desc: 'Understand shifts in device posture, session context, mobility, and network signals to verify whether current activity matches expected operating context.',
    chip: 'Hardware Posture · Mobility Sensor Fusion',
  },
  {
    num: '02',
    tag: 'BEHAVIOR',
    title: 'Behavioral Continuity',
    desc: 'Analyze changes in activity rhythms over time to identify potential discontinuities that a static credential check alone completely misses.',
    chip: 'Touch Profiles · Keystroke & Interaction Cadence',
  },
  {
    num: '03',
    tag: 'EXPLAINABLE',
    title: 'Explainable Risk Intelligence',
    desc: 'Combine available telemetry into a defensible risk score with explicit contributing factors, empowering platforms to act with full auditability.',
    chip: 'Weighted Anomaly Attribution · Audit Trail',
  },
  {
    num: '04',
    tag: 'PROPORTIONATE',
    title: 'Context-Aware Verification',
    desc: 'Support proportionate step-up verification only when warranted, completely avoiding disruption to honest drivers during active trips.',
    chip: 'Zero-Friction Sentinel · Silent Baseline Check',
  },
  {
    num: '05',
    tag: 'BASELINES',
    title: 'Adaptive Trust Baselines',
    desc: 'Continuously calibrate behavioral baselines as driver routines evolve over weeks, isolating legitimate schedule shifts from abrupt driver swaps.',
    chip: 'Dual-Timescale · Seasonal & Routine Evolution',
  },
  {
    num: '06',
    tag: 'HANDOFFS',
    title: 'Account Handoff Detection',
    desc: 'Detect intricate account-sharing where usage shifts between individuals and later returns, uncovering complex multi-driver sharing rings.',
    chip: 'Cross-Driver Signatures · Fleet Ring Isolation',
  },
];

export const TheApproach: React.FC = () => {
  const platRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const updateDimensions = () => {
      const plat = platRef.current;
      const track = trackRef.current;
      if (!plat || !track) return;

      const dist = Math.max(0, track.scrollWidth - window.innerWidth);
      plat.style.height = `${window.innerHeight + dist}px`;
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    const onScroll = () => {
      const plat = platRef.current;
      const track = trackRef.current;
      const prog = progRef.current;
      if (!plat || !track) return;

      const vh = window.innerHeight;
      const dist = Math.max(0, track.scrollWidth - window.innerWidth);
      const r = plat.getBoundingClientRect();
      const progress = dist ? clamp(-r.top / (r.height - vh), 0, 1) : 0;

      track.style.transform = `translate3d(${-progress * dist}px, 0, 0)`;
      if (prog) {
        prog.style.width = `${progress * 100}%`;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <section ref={platRef} className="plat" id="approach">
      <div id="platform" tabIndex={-1} style={{ position: 'absolute', top: 0, left: 0 }} />
      <div className="pin">
        <header className="approach-header">
          <div className="approach-header-top">
            <span className="pill">
              <i></i>THE TRUST CONTINUUM
            </span>
            <div className="track-hint">
              <span>6 Continuous Signal Layers</span>
              <span className="track-hint-dot" aria-hidden="true">·</span>
              <span>Scroll horizontally →</span>
            </div>
          </div>

          <h2>
            Identity isn't a <em>one-time event.</em>
            <br />
            It's a pattern over time.
          </h2>
          <p className="section-desc">
            AsliKaun fuses continuous mobility, behavioral, and device signals into an adaptive trust baseline—distinguishing routine changes from account sharing.
          </p>
        </header>

        <div ref={trackRef} className="track" id="track">
          {PILLARS.map((p) => (
            <article key={p.num} className="pc pc-text-card glass">
              <div className="pc-card-header">
                <span className="pc-pill">
                  <span className="pc-num">{p.num}</span>
                  <span className="pc-tag">{p.tag}</span>
                </span>
                <span className="pc-live">● CONTINUOUS</span>
              </div>

              <div className="pc-card-body">
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>

              <div className="pc-card-footer">
                <span className="pc-chip">{p.chip}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="prog-wrapper">
          <div className="prog">
            <i ref={progRef} id="prog"></i>
          </div>
        </div>
      </div>
    </section>
  );
};
