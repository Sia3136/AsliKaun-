import React from 'react';

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  return (
    <nav className="glass site-nav" aria-label="Main Navigation">
      <a className="logo" href="#top">
        <span className="ring" aria-hidden="true"></span>
        AsliKaun
      </a>

      <div className="links">
        <a href="#problem">The Problem</a>
        <a href="#approach">The Approach</a>
        <a href="#pipeline">Architecture</a>
        <a href="/dashboard.html" style={{ color: 'var(--accent, #1169dc)', fontWeight: 600 }}>Fleet Dashboard</a>
      </div>

      <div className="nav-actions">
        <a className="btn ghost nav-btn" href="/auth?mode=login">
          Sign in
        </a>
        <a className="btn solid nav-btn" href="/auth?mode=signup">
          Get started ↗
        </a>
        <button
          className="theme-toggle"
          id="themeToggle"
          aria-label="Toggle light/dark theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? (
            <svg
              className="sun-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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
            <svg
              className="moon-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
};
