import React from 'react';

const FOOTER_COLUMNS = {
  Approach: ['Continuous Intelligence', 'Contextual Continuity', 'Behavioral Continuity', 'Adaptive Baselines', 'Handoff Awareness'],
  Architecture: ['Dual-Axis Assessment', 'Dual-Timescale', 'Explainable Signals', 'Legitimate Changes', 'Privacy Architecture'],
  Resources: ['Architecture Guide', 'Explainability Guide', 'Account Handoff Guide', 'Documentation', 'Security'],
  Governance: ['Fairness & Safety', 'Privacy Policy', 'Terms of Service', 'Appeal Framework', 'Contact'],
};

export const Footer: React.FC = () => {
  return (
    <footer>
      <div className="wrap">
        <div className="fg" id="fg">
          <div>
            <a className="logo" href="#top">
              <span className="ring" aria-hidden="true"></span>
              TrustMesh
            </a>
            <p>
              Continuous Identity Intelligence. Trust the behavior. Detect the handoff without introducing friction for legitimate drivers.
            </p>
            <span className="sys">
              <i></i>All trust systems operational
            </span>
          </div>

          {Object.entries(FOOTER_COLUMNS).map(([category, links]) => (
            <div key={category}>
              <h4>{category}</h4>
              <ul>
                {links.map((link) => (
                  <li key={link}>
                    <a href="#">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="fb">
          <span>© 2026 TrustMesh Systems. Continuous Identity Intelligence. All rights reserved.</span>
          <div>
            <a href="#approach">The Approach</a>
            <a href="#pipeline">Architecture</a>
            <a href="#cta">Contact</a>
          </div>
        </div>
      </div>

      <svg className="wm" viewBox="0 0 1200 230" aria-hidden="true">
        <defs>
          <linearGradient id="rg">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="0.5" stopColor="var(--accent-2)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <text className="b" x="0" y="205">
          TrustMesh
        </text>
        <text className="d" x="0" y="205">
          TrustMesh
        </text>
        <text className="r" x="0" y="205">
          TrustMesh
        </text>
      </svg>
    </footer>
  );
};
