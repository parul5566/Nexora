'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fd)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Registration failed');
      // Fetch the verification token via the dev transport endpoint
      // (stand-in for email delivery; remove once a mail provider is wired).
      const vres = await fetch(`${API}/api/v1/auth/dev-verification-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.user.email }),
      });
      if (vres.ok) setVerifyToken((await vres.json()).token);
      else setError('Registered! Check your email for the verification token.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    setError('');
    const res = await fetch(`${API}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Verification failed'); return; }
    router.push('/login?verified=1');
  }

  return (
    <main className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <h1 className="logo">Bhasebook</h1>
        <h2 style={{ fontSize: 22, margin: '4px 0 2px' }}>Create Account</h2>
        <p className="muted" style={{ marginBottom: 20 }}>It&apos;s quick and easy.</p>
        {verifyToken ? (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Account created. Your verification token (dev transport):
            </p>
            <code style={{ wordBreak: 'break-all', display: 'block', marginBottom: 12 }}>{verifyToken}</code>
            <div className="field">
              <input id="vt" className="input" placeholder="Paste verification token" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={onVerify}>Verify email</button>
            {error && <p className="error-text">{error}</p>}
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
            <div className="field">
              <input id="displayName" name="displayName" className="input" placeholder="Full name" required maxLength={60} />
            </div>
            <div className="field">
              <input id="username" name="username" className="input" placeholder="Username" required pattern="[A-Za-z0-9_]{3,30}" />
            </div>
            <div className="field">
              <input id="email" name="email" type="email" className="input" placeholder="Mobile number or email" required />
            </div>
            <div className="field">
              <input id="password" name="password" type="password" className="input" placeholder="New password" required minLength={8} />
            </div>
            <button className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
            {error && <p className="error-text">{error}</p>}
            <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
