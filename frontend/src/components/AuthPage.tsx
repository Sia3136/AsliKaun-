import { useState, type FormEvent } from 'react';

const API_BASE = '';
const DEMO_EMAIL = 'admin@aslikaun.ai';
const DEMO_PASSWORD = 'aslikaun';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function storeSession(token: string, username: string, userEmail: string) {
    ['aslikaun-auth', 'tm-auth'].forEach((k) => sessionStorage.setItem(k, 'true'));
    ['aslikaun-auth-token', 'tm-auth-token'].forEach((k) => sessionStorage.setItem(k, token));
    sessionStorage.setItem('aslikaun-auth-user', JSON.stringify({ email: userEmail, name: username, role: 'admin' }));
    window.location.assign('/fleet-dashboard.html');
  }

  async function performLogin(usernameVal: string, passwordVal: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameVal, password: passwordVal }),
      });
      if (res.ok) {
        const data = await res.json();
        storeSession(data.access_token || data.token || `admin-${Date.now()}`, data.username || 'Fleet Admin', usernameVal);
        return;
      }
      const data = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(data.detail || `Sign in error (${res.status})`);
    } catch (err: unknown) {
      // Graceful fallback ONLY for the one-click demo button's own fixed
      // credentials, and ONLY when the backend itself is unreachable
      // (a network/fetch failure, not a rejected login) — so this never
      // accepts an arbitrary typed password as long as it merely
      // resembles the admin email. Previously it did: any login attempt
      // using "admin"/"admin@aslikaun.ai" as the username succeeded
      // locally even on a real 401 from the backend.
      const isNetworkFailure = err instanceof TypeError;
      if (isNetworkFailure && usernameVal === DEMO_EMAIL && passwordVal === DEMO_PASSWORD) {
        storeSession(`demo-token-${Date.now()}`, 'Fleet Admin', DEMO_EMAIL);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to sign in. Verify backend status.');
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    performLogin(DEMO_EMAIL, DEMO_PASSWORD);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    performLogin(email, password);
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="auth-brand" href="/" aria-label="AsliKaun home">
          <img src="/aslikaun-logo.png" alt="AsliKaun logo" className="auth-logo-img" />
          <span>AsliKaun</span>
        </a>
        <div className="auth-story-copy">
          <span className="auth-kicker">Fleet operations</span>
          <h1>Sign in to <span>the console.</span></h1>
          <p>Live driver scores, review queue, and drift history for your delivery fleet.</p>
        </div>
        <p className="auth-footnote">AsliKaun Operations Console</p>
      </section>

      <section className="auth-form-side">
        <a className="auth-brand auth-mobile-brand" href="/" aria-label="AsliKaun home">
          <img src="/aslikaun-logo.png" alt="AsliKaun logo" className="auth-logo-img" />
          <span>AsliKaun</span>
        </a>
        <div className="auth-card">
          <span className="auth-secure"><i />Secure admin access</span>
          <h2>Fleet Admin Console</h2>
          <p className="auth-intro">Sign in with your operations account.</p>

          <form onSubmit={handleSubmit} className="auth-fields" style={{ marginTop: '27px' }}>
            <label>
              Admin Email
              <input
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="username"
                placeholder={DEMO_EMAIL}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                placeholder="Enter password"
                required
              />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? 'Signing in…' : 'Sign in'}</span>
              <span>→</span>
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button
            type="button"
            className="auth-submit auth-submit-secondary"
            onClick={handleDemoLogin}
            disabled={loading}
          >
            <span>Continue with demo account</span>
            <span>↗</span>
          </button>

          <p className="auth-legal">Authorized fleet personnel only</p>
        </div>
      </section>
    </main>
  );
}
