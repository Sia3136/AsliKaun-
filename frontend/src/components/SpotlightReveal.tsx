import React, { useRef, useEffect, useState, useCallback } from 'react';

export const SpotlightReveal: React.FC = () => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const revealImgRef = useRef<HTMLImageElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const RADIUS = 215;
  const EASING = 0.14;

  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothRef = useRef({ x: -9999, y: -9999 });
  const isInsideRef = useRef(false);

  const updatePointerCoords = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    mouseRef.current.x = clientX - rect.left;
    mouseRef.current.y = clientY - rect.top;
  }, []);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isInsideRef.current = true;
    setIsHovering(true);
    updatePointerCoords(e.clientX, e.clientY);
    smoothRef.current.x = mouseRef.current.x;
    smoothRef.current.y = mouseRef.current.y;
  }, [updatePointerCoords]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    updatePointerCoords(e.clientX, e.clientY);
  }, [updatePointerCoords]);

  const handlePointerLeave = useCallback(() => {
    isInsideRef.current = false;
    setIsHovering(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    isInsideRef.current = true;
    setIsHovering(true);
    updatePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
    smoothRef.current.x = mouseRef.current.x;
    smoothRef.current.y = mouseRef.current.y;
  }, [updatePointerCoords]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    updatePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
  }, [updatePointerCoords]);

  const handleTouchEnd = useCallback(() => {
    isInsideRef.current = false;
    setIsHovering(false);
  }, []);

  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (isInsideRef.current) {
        smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * EASING;
        smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * EASING;

        const rad = `${RADIUS}px`;
        const mx = `${smoothRef.current.x.toFixed(2)}px`;
        const my = `${smoothRef.current.y.toFixed(2)}px`;

        if (revealImgRef.current) {
          revealImgRef.current.style.setProperty('--spotlight-radius', rad);
          revealImgRef.current.style.setProperty('--mask-x', mx);
          revealImgRef.current.style.setProperty('--mask-y', my);
        }

        if (reticleRef.current) {
          reticleRef.current.style.left = mx;
          reticleRef.current.style.top = my;
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="spotlight-wrapper">
      <div className="stage-wrapper">
        {/* Ambient Glow Behind Portrait */}
        <div className="stage-glow" aria-hidden="true"></div>

        {/* Ghost Typography Background Elements */}
        <div className="ghost-text top" aria-hidden="true">TRUST</div>
        <div className="ghost-text bottom" aria-hidden="true">MESH</div>

        {/* Signal Stream A: Baseline Telemetry (Left Floating Glass Card) */}
        <div className="signal-card stream-a" aria-label="Stream A Signals">
          <div className="signal-header">
            <span>Stream A: Baseline</span>
            <span className="tag-verified">VERIFIED</span>
          </div>
          <div className="signal-row">
            <span>Device Context</span>
            <b>iPhone 15 Pro</b>
          </div>
          <div className="signal-row">
            <span>Mobility Cadence</span>
            <b>99.4% Match</b>
          </div>
          <div className="signal-row">
            <span>Continuity</span>
            <b>Continuous</b>
          </div>
        </div>

        {/* Central Interactive Portrait Canvas Stack */}
        <div
          ref={stageRef}
          className={`image-stage ${isHovering ? 'is-hovering' : ''}`}
          id="imageStage"
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Status Badges */}
          <div className="spotlight-badge top-badge glass">
            <span className="badge-dot verified"></span>VERIFIED ACCOUNT HOLDER
          </div>
          <div className="spotlight-badge bot-badge glass">
            <span className="badge-dot alert"></span>POTENTIAL HANDOFF DETECTED
          </div>

          {/* Base Image (Clean Primary Headshot - Verified Account Holder) */}
          <img
            className="img-base"
            id="imgBase"
            src="/assets/hero-front.png"
            alt="Verified Account Holder"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.indexOf('hero-front.png') !== -1 && target.src.indexOf('/assets/') !== -1) {
                target.src = '/dashboard/hero-front.png';
              }
            }}
          />

          {/* Reveal Image (Alternate Driver Headshot Revealed by Spotlight) */}
          <img
            ref={revealImgRef}
            className="img-reveal"
            id="imgReveal"
            src="/assets/hero-back.png"
            alt="Revealed Alternate Person (Potential Handoff)"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.indexOf('hero-back.png') !== -1 && target.src.indexOf('/assets/') !== -1) {
                target.src = '/dashboard/hero-back.png';
              }
            }}
          />

          {/* Smooth Interactive Cursor Reticle */}
          <div ref={reticleRef} className="reticle" id="reticle"></div>
        </div>

        {/* Signal Stream B: Discontinuity Detected (Right Floating Glass Card) */}
        <div className="signal-card stream-b" aria-label="Stream B Signals">
          <div className="signal-header">
            <span>Stream B: Discontinuity</span>
            <span className="tag-warning">HANDOFF FLAG</span>
          </div>
          <div className="signal-row">
            <span>Device Shift</span>
            <b>Pixel 8 (Unenrolled)</b>
          </div>
          <div className="signal-row">
            <span>Interaction Profile</span>
            <b>68% Variance</b>
          </div>
          <div className="signal-row">
            <span>Risk Assessment</span>
            <b>ELEVATED</b>
          </div>
        </div>
      </div>

      {/* User Instruction Hint Pill */}
      <div className="hint-pill">
        <span className="radar-dot"></span>
        <span>Hover face to reveal handoff</span>
      </div>
    </div>
  );
};
