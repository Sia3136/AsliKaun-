import React from 'react';

interface NavbarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    try {
      setIsLoggedIn(sessionStorage.getItem('tm-auth') === 'true');
    } catch {}
  }, []);

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner">
        {/* Brand Left */}
        <a className="brand-link" href="#top" aria-label="AsliKaun Home">
          <div className="brand-mark" aria-hidden="true">
            <img src="/aslikaun-logo.png" alt="AsliKaun Logo" className="brand-logo-img" />
          </div>
          <span className="brand-name">AsliKaun</span>
        </a>

        {/* Center Nav Links */}
        <nav className="nav-links" aria-label="Primary Navigation">
          <a href="#problem" className="nav-item">How it works</a>
          <a href="#approach" className="nav-item">Platform</a>
          <a href="#pipeline" className="nav-item">Why AsliKaun?</a>
        </nav>

        {/* Right Action: Theme toggle + Pill Button */}
        <div className="nav-actions">
          <button
            className="nav-theme-toggle"
            id="themeToggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {isLoggedIn ? (
            <a className="btn-get-access" href="/fleet-dashboard.html">
              Open Console ↗
            </a>
          ) : (
            <a className="btn-get-access" href="/auth?mode=login">
              Sign in ↗
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
