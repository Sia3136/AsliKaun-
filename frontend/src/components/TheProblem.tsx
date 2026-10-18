import React from 'react';

interface ProblemItem {
  badge: string;
  title: string;
  desc: string;
  telemetry: string;
  icon: React.ReactNode;
}

const PROBLEMS: ProblemItem[] = [
  {
    badge: 'STATIC CHECK FAILURE',
    title: 'Static Verification',
    desc: 'A valid credential or biometric check only verifies identity at a single instant. It leaves hours of downstream operations completely unmonitored.',
    telemetry: 'Single Point in Time (T₀) · Zero Session Memory',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    badge: 'HIDDEN DISCONTINUITY',
    title: 'Behavioral Shifts',
    desc: 'Account sharing produces subtle yet distinct shifts across interaction rhythms, device posture, mobility cadence, and application workflows.',
    telemetry: 'Multi-Signal Drift · Subtle Driver Handoffs',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    badge: 'UNNECESSARY FRICTION',
    title: 'False Alarms',
    desc: 'Legitimate routine changes, new phones, or travel must not trigger disruptive lockouts. Precision requires contextual intelligence to prevent false alarms.',
    telemetry: 'Context-Aware Override · Zero Trip Disruption',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

export const TheProblem: React.FC = () => {
  return (
    <section className="section-pad" id="problem">
      <div className="wrap">
        <header className="problem-header">
          <span className="pill">
            <i></i>THE IDENTITY GAP
          </span>
          <h2>
            Authentication verifies access.
            <br />
            TrustMesh investigates <em>continuity.</em>
          </h2>
          <p className="section-desc">
            A driver can pass an initial login check while the vehicle and account are later operated by someone else. The challenge isn't detecting every deviation—it's distinguishing legitimate routine changes from driver handoffs.
          </p>
        </header>

        <div className="prob-grid">
          {PROBLEMS.map((prob, i) => (
            <div key={i} className="prob-card glass">
              <div className="prob-card-top">
                <div className="prob-icon-wrap" aria-hidden="true">
                  {prob.icon}
                </div>
                <span className="badge">
                  <span className="badge-dot verified" style={{ width: 4, height: 4 }}></span>
                  {prob.badge}
                </span>
              </div>

              <h3>{prob.title}</h3>
              <p>{prob.desc}</p>

              <div className="prob-telemetry">
                <span>{prob.telemetry}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
