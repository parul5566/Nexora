'use client';

import { useState, useEffect, Suspense, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fd)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Login failed');
      localStorage.setItem('nexora_token', data.token);
      router.push('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {params.get('verified') && (
        <p className="success-text" style={{ marginBottom: 12 }}>Email verified — log in below.</p>
      )}
      <div className="field">
        <input name="email" type="email" className="input" placeholder="Email address" required aria-label="Email" />
      </div>
      <div className="field" style={{ position: 'relative' }}>
        <input
          name="password" type={showPw ? 'text' : 'password'} className="input"
          placeholder="Password" required aria-label="Password" style={{ paddingRight: 48 }}
        />
        <button
          type="button" aria-label={showPw ? 'Hide password' : 'Show password'}
          onClick={() => setShowPw((s) => !s)}
          style={{ position: 'absolute', right: 12, top: 12, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          {showPw ? '🙈' : '👁️'}
        </button>
      </div>
      <button className="btn" style={{ width: '100%' }} disabled={loading}>
        {loading ? 'Logging in…' : 'Log In'}
      </button>
      {error && <p className="error-text">{error}</p>}
      <div className="muted" style={{ textAlign: 'center', margin: '16px 0' }}>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <span style={{ flex: 1 }} className="divider" />
        <span className="muted">or</span>
        <span style={{ flex: 1 }} className="divider" />
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        <Link href="/register" className="btn btn-secondary" style={{ width: '100%', color: 'var(--fb-text)' }}>Create new account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // already logged in → straight to feed
    const token = localStorage.getItem('nexora_token');
    if (token) {
      fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (r.ok) { router.replace('/home'); } else { setChecked(true); }
        })
        .catch(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, [router]);

  return (
    <main className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <h1 className="logo">Bhasebook</h1>
        <h2 style={{ fontSize: 20, margin: '4px 0 20px' }}>Welcome Back</h2>
        {checked ? (
          <SuspenseWrapper>
            <LoginForm />
          </SuspenseWrapper>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    </main>
  );
}

function SuspenseWrapper({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>;
}
