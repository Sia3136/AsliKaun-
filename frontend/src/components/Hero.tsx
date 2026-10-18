import React from 'react';
import { SpotlightReveal } from './SpotlightReveal';

export const Hero: React.FC = () => {
  return (
    <section className="hero" id="hero">
      <div className="copy">
        <span className="pill">
          <i></i>CONTINUOUS IDENTITY INTELLIGENCE
        </span>

        <h1>
          <span className="l" style={{ '--i': 0 } as React.CSSProperties}>
            <span>The account stays.</span>
          </span>
          <span className="l" style={{ '--i': 1 } as React.CSSProperties}>
            <span>
              But does the <em>person?</em>
            </span>
          </span>
          <span className="l" style={{ '--i': 2 } as React.CSSProperties}>
            <span>Detect the handoff.</span>
          </span>
        </h1>

        <p className="lede">
          AsliKaun continuously analyzes behavioral and contextual continuity to detect account handoffs with explainable precision—safeguarding platforms without disrupting legitimate drivers.
        </p>

        <div className="btns">
          <a className="btn solid" href="/auth?mode=signup">
            Get started ↗
          </a>
          <a className="btn ghost" href="#pipeline">
            See How It Works
          </a>
        </div>

        <div className="meta">
          <span>
            <b>Behavioral</b> Continuity
          </span>
          <span>
            <b>Context-Aware</b> Risk
          </span>
          <span>
            <b>Explainable</b> Signals
          </span>
        </div>
      </div>

      <SpotlightReveal />
    </section>
  );
};
