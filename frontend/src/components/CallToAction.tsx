import React from 'react';

export const CallToAction: React.FC = () => {
  return (
    <section className="cta" id="cta">
      <div className="wrap">
        <div className="cp2 glass">
          <span className="eyebrow">The Future of Continuous Trust</span>
          <h2>
            Every session tells a story.
            <br />
            Connect the signals.
          </h2>
          <p className="lede-cta">
            Discover how AsliKaun connects behavioral patterns, contextual intelligence, and explainable risk assessments to identify potential account handoffs.
          </p>
          <div className="btns">
            <a className="btn solid" href="/auth?mode=login">
              Sign in to the demo ↗
            </a>
            <a className="btn ghost" href="#platform">
              Discover the Platform
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
