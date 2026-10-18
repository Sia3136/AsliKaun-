import React, { useEffect, useRef, useState } from 'react';

interface WordDef {
  text: string;
  isSpecial?: boolean;
  breakAfter?: boolean;
}

const WORDS: WordDef[] = [
  { text: 'The' },
  { text: 'account' },
  { text: 'is' },
  { text: 'verified.' },
  { text: 'The' },
  { text: 'identity' },
  { text: "isn't" },
  { text: 'guaranteed.', isSpecial: true, breakAfter: true },
  { text: 'Continuous' },
  { text: 'identity' },
  { text: 'intelligence' },
  { text: 'for' },
  { text: 'a' },
  { text: 'world' },
  { text: 'beyond' },
  { text: 'passwords.' },
];

export const ScrollWordReveal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollableDistance = container.offsetHeight - viewportHeight;

      if (scrollableDistance <= 0) return;

      // Calculate progress from 0 (entry into view) to 1 (fully scrolled)
      const currentScroll = -rect.top;
      const normalizedProgress = Math.max(0, Math.min(1, currentScroll / scrollableDistance));
      setProgress(normalizedProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section ref={containerRef} className="scroll-reveal-container" id="narrative-gap">
      <div className="scroll-reveal-sticky">
        <div className="scroll-reveal-content">
          <p className="scroll-reveal-text">
            {WORDS.map((w, i) => {
              // Calculate activation threshold for each word across the scroll range
              const step = 1 / WORDS.length;
              const wordThreshold = i * step;
              const wordActivation = Math.max(0, Math.min(1, (progress - wordThreshold) / step));
              const isLit = wordActivation >= 0.95;
              const isActive = wordActivation > 0.1 && wordActivation < 0.95;

              return (
                <React.Fragment key={i}>
                  <span
                    className={`reveal-word ${w.isSpecial ? 'special-italic' : ''} ${isLit ? 'lit' : ''} ${isActive ? 'active' : ''}`}
                    style={{
                      opacity: 0.18 + wordActivation * 0.82,
                      filter: isLit || isActive
                        ? `drop-shadow(0 0 ${w.isSpecial ? 12 : 18}px ${w.isSpecial ? 'rgba(255, 122, 61, 0.65)' : 'rgba(255, 255, 255, 0.7)'})`
                        : 'none',
                    }}
                  >
                    {w.text}
                  </span>
                  {i < WORDS.length - 1 ? ' ' : ''}
                  {w.breakAfter && <br className="reveal-line-break" />}
                </React.Fragment>
              );
            })}
          </p>
        </div>
      </div>
    </section>
  );
};
