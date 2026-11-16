'use client';
// Sign-in page
import { useState } from 'react';
import { api } from '@/lib/apiClient.js';
import { Field, Notice } from '@/components/ui.js';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/login', { method: 'POST', body: { username, password } });
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-panel">
        <div className="brand brand-large">
          <span className="brand-tag" aria-hidden="true">HS</span>
          <span className="brand-name">HerdSense</span>
        </div>
        <p className="login-intro">Health, breeding and milk records for the herd.</p>

        <form onSubmit={signIn} className="stack">
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Notice kind="error">{error}</Notice>
          <button type="submit" className="button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}
