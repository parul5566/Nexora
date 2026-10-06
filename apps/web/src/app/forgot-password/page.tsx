'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API}/api/v1/auth/password/reset-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) { setError('Request failed'); return; }
    const vres = await fetch(`${API}/api/v1/auth/dev-verification-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose: 'password_reset' }),
    });
    if (vres.ok) setToken((await vres.json()).token);
    setNotice('If that account exists, a reset token has been sent.');
    setStage('reset');
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API}/api/v1/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Reset failed'); return; }
    router.push('/login');
  }

  return (
    <main className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <h1 className="logo">Nexora</h1>
        <h2 style={{ fontSize: 20, margin: '4px 0 20px' }}>Forgot Password?</h2>
        {stage === 'request' ? (
          <form onSubmit={onRequest} style={{ textAlign: 'left' }}>
            <div className="field">
              <input id="email" type="email" className="input" placeholder="Account email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn" style={{ width: '100%' }}>Send reset token</button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form onSubmit={onReset} style={{ textAlign: 'left' }}>
            {notice && <p className="success-text" style={{ marginBottom: 12 }}>{notice}</p>}
            {token && (
              <p className="muted" style={{ marginBottom: 12, wordBreak: 'break-all' }}>Dev transport token: {token}</p>
            )}
            <div className="field">
              <input id="token" className="input" placeholder="Reset token" required value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div className="field">
              <input id="password" type="password" className="input" placeholder="New password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn" style={{ width: '100%' }}>Set new password</button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
