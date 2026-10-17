import { useState, type FormEvent } from 'react';

type Mode = 'login' | 'signup';

export function AuthPage({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState(initialMode === 'login' ? 'admin@trustmesh.ai' : '');
  const [password, setPassword] = useState(initialMode === 'login' ? 'trustmesh' : '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setEmail(next === 'login' ? 'admin@trustmesh.ai' : '');
    setPassword(next === 'login' ? 'trustmesh' : '');
    setConfirmPassword('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password || (mode === 'signup' && (!name.trim() || !organization.trim()))) {
      setError('Complete all required fields to continue.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    // The supplied design describes a simulated demo, so keep this handoff local.
    sessionStorage.setItem('tm-auth', 'true');
    window.location.assign('/dashboard.html');
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="auth-brand" href="/" aria-label="TrustMesh home"><span className="auth-brand-mark">◈</span> TrustMesh</a>
        <div className="auth-story-copy">
          <span className="auth-kicker">Identity risk intelligence</span>
          <h1>See the signal.<br /><span>Protect the network.</span></h1>
          <p>Monitor account-sharing risk, investigate suspicious sessions, and make confident decisions across your fleet.</p>
          <div className="auth-stats">
            <div><strong>24/7</strong><span>Fleet monitoring</span></div>
            <div><strong>7</strong><span>Risk signals</span></div>
            <div><strong>Live</strong><span>Decision engine</span></div>
          </div>
        </div>
        <p className="auth-footnote">TrustMesh Admin Console · Simulated demo environment</p>
      </section>

      <section className="auth-form-side">
        <a className="auth-brand auth-mobile-brand" href="/" aria-label="TrustMesh home"><span className="auth-brand-mark">◈</span> TrustMesh</a>
        <a className="auth-home-link" href="/">← Back to home</a>
        <div className="auth-card">
          <span className="auth-secure"><i />Secure admin access</span>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Sign in to open the TrustMesh control center.' : 'Set up access to your TrustMesh workspace.'}</p>
          <form onSubmit={submit} className="auth-fields">
            {mode === 'signup' && <div className="auth-field-row">
              <label>Full name<input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} autoComplete="name" placeholder="Alex Morgan" required /></label>
              <label>Organization<input value={organization} onChange={(e) => { setOrganization(e.target.value); setError(''); }} autoComplete="organization" placeholder="Acme Mobility" required /></label>
            </div>}
            <label>Work email<input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} autoComplete="email" placeholder="you@company.com" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter your password" minLength={mode === 'signup' ? 8 : undefined} required /></label>
            {mode === 'signup' && <label>Confirm password<input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} autoComplete="new-password" placeholder="Repeat your password" required /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit">{mode === 'login' ? 'Sign in to TrustMesh' : 'Create account'}<span>↗</span></button>
          </form>
          <div className="auth-demo-note"><strong>{mode === 'login' ? 'Demo access' : 'Hackathon demo'}</strong><p>{mode === 'login' ? 'Credentials are prefilled for this demo. No account data is transmitted.' : 'Account creation is simulated locally. No personal data is stored or transmitted.'}</p></div>
          <p className="auth-switch">{mode === 'login' ? 'New to TrustMesh?' : 'Already have an account?'} <button type="button" onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
          <p className="auth-legal">Authorized personnel only · Activity is audit logged</p>
        </div>
      </section>
    </main>
  );
}
