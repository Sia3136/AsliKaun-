import React, { useEffect, useRef } from 'react';

interface ArchitectureCardData {
  tag: string;
  title: string;
  desc: string;
  img: string;
  badge: string;
  telemetry: string;
}

const ARCHITECTURE_CARDS: ArchitectureCardData[] = [
  {
    tag: '01 / CORE ARCHITECTURE',
    title: 'Dual-axis trust assessment',
    desc: 'Evaluate contextual continuity and behavioral continuity separately, helping the system distinguish different types of deviations without confusing a new phone with a driver handoff.',
    img: '/assets/arch-dual-axis.jpg',
    badge: 'DUAL-AXIS TELEMETRY MATRIX',
    telemetry: 'Context (X) vs Behavior (Y) · 96% Baseline Fit',
  },
  {
    tag: '02 / TEMPORAL MODELING',
    title: 'Dual-timescale baselines',
    desc: 'Compare activity against longer-term habits and more recent patterns to better interpret gradual changes, seasonal shifts, and sudden handoff deviations.',
    img: '/assets/arch-dual-timescale.jpg',
    badge: '30-DAY MACRO VS REAL-TIME MICRO',
    telemetry: 'Multi-Timescale Convergence · Variance Deviation Alert',
  },
  {
    tag: '03 / IDENTITY DYNAMICS',
    title: 'Account-handoff awareness',
    desc: 'Analyze complex scenarios where account usage shifts between different individuals and later returns to the original account holder, isolating shared fleets.',
    img: '/assets/arch-handoff.jpg',
    badge: 'GPS ROUTE SHIFT & FLEET DETECTION',
    telemetry: 'Driver Handoff Point · Multi-Operator Ring Isolation',
  },
  {
    tag: '04 / TRANSPARENCY',
    title: 'Explainable risk signals',
    desc: 'Present the concrete factors contributing to an alert instead of relying on an unexplained black-box risk score, empowering rapid, defensible admin auditability.',
    img: '/assets/arch-explainable.jpg',
    badge: 'EXPLAINABLE FACTOR ATTRIBUTION',
    telemetry: 'Trust Confidence 84% · Defensible Attribution Cockpit',
  },
  {
    tag: '05 / FRICTION REDUCTION',
    title: 'Legitimate-change awareness',
    desc: 'Incorporate declared device changes, planned travel, and contextual notes when interpreting unusual activity to safeguard honest driver productivity.',
    img: '/assets/arch-legitimate.jpg',
    badge: 'VERIFIED CONTEXT OVERRIDE',
    telemetry: 'Declared Hardware Profile · 0 Trip Interruptions',
  },
  {
    tag: '06 / ETHICAL GOVERNANCE',
    title: 'Privacy-conscious design',
    desc: 'Emphasize proportionate signal collection, strictly minimized data exposure, and clear opportunities for driver review, verification, and appeal.',
    img: '/assets/arch-privacy.jpg',
    badge: 'ZERO-KNOWLEDGE PRIVACY VAULT',
    telemetry: 'On-Device Encrypted Vault · Driver Appeal Framework',
  },
];

export const ArchitectureStack: React.FC = () => {
  const cardsRef = useRef<(HTMLElement | null)[]>([]);

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
            <i></i>CONTINUOUS ARCHITECTURE
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
                <div className="vp-img-wrap">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="vp-img"
                    loading="lazy"
                  />
                  <div className="vp-badge-overlay">
                    <span className="vp-badge">{card.badge}</span>
                  </div>
                </div>
              </div>

              <div className="ov"></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
