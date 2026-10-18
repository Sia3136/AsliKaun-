import React, { useEffect, useRef } from 'react';

interface BackgroundVideoProps {
  theme: 'light' | 'dark';
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({ theme }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    let sy = window.scrollY;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onFrame = () => {
      sy = lerp(sy, window.scrollY, 0.075);
      if (Math.abs(sy - window.scrollY) < 0.1) sy = window.scrollY;

      const vh = window.innerHeight || 800;
      const vid = videoRef.current;
      const veil = veilRef.current;

      if (vid && !isReducedMotion) {
        const xDrift = Math.sin(sy / 800) * 2;
        const yDrift = Math.sin(sy / 1400) * -1.5;
        vid.style.transform = `translate3d(${xDrift}vw, ${yDrift}vh, 0) scale(1.05)`;
      }

      const baseOp = theme === 'dark' ? 0.75 : 0.45;
      if (vid) {
        vid.style.opacity = `${baseOp * (1 - clamp(sy / vh, 0, 1) * 0.4)}`;
      }

      if (veil) {
        veil.style.opacity = `${clamp((sy - vh * 0.15) / (vh * 0.5), 0, 1) * 0.92}`;
      }

      animationFrameId = requestAnimationFrame(onFrame);
    };

    animationFrameId = requestAnimationFrame(onFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <>
      <video
        ref={videoRef}
        id="bgVideo"
        autoPlay
        muted
        loop
        playsInline
        poster="/assets/hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/assets/hero.webm" type="video/webm" />
        <source src="/assets/hero.mp4" type="video/mp4" />
      </video>
      <div ref={veilRef} id="veil" aria-hidden="true" />
    </>
  );
};
