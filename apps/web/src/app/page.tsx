'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function SplashPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
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

  if (!checked) {
    return <main className="splash"><div className="splash-mark">N</div></main>;
  }

  return (
    <main className="splash">
      <div className="splash-mark">N</div>
      <h1 style={{ fontSize: 34, letterSpacing: -1 }}>Nexora</h1>
      <p style={{ fontSize: 17, maxWidth: 320, opacity: 0.95 }}>
        Connect with people around the world
      </p>
      <Link href="/register" className="btn btn-white" style={{ width: '100%', maxWidth: 320, fontSize: 16 }}>
        Get Started
      </Link>
      <p style={{ fontSize: 15 }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}>Log in</Link>
      </p>
    </main>
  );
}
