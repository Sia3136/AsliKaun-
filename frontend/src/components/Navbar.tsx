import React from 'react';

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="site-header-wrapper" role="banner">
      <nav className="site-nav" aria-label="Main Navigation">
        <a className="brand-link" href="#top" aria-label="TrustMesh Home">
          <div className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V7L12 2Z"
                fill="url(#tm-brand-grad)"
                opacity="0.18"
              />
              <path
                d="M12 3.5L4.5 7.7V11.8C4.5 16.4 7.7 20.7 12 21.8C16.3 20.7 19.5 16.4 19.5 11.8V7.7L12 3.5Z"
                stroke="url(#tm-brand-grad)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="brand-check"
              />
              <defs>
                <linearGradient id="tm-brand-grad" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00e5ff" />
                  <stop offset="0.5" stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-name">TrustMesh</span>
          <span className="brand-tag">v2.4</span>
        </a>

        <div className="nav-center-links">
          <a href="#problem" className="nav-link">The Problem</a>
          <a href="#approach" className="nav-link">The Approach</a>
          <a href="#pipeline" className="nav-link">Architecture</a>
          <a href="/dashboard.html" className="nav-link nav-link-highlight">
            <span className="pulse-beacon" aria-hidden="true"></span>
            Fleet Console
          </a>
        </div>

        <div className="nav-end-actions">
          <a className="nav-btn-ghost" href="/auth?mode=login">
            Sign in
          </a>
          <a className="nav-btn-primary" href="/dashboard.html">
            <span>Explore Demo</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <button
            className="nav-theme-btn"
            id="themeToggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
};
