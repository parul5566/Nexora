'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../../components/shell';

interface Job { id: number; title: string; company: { name: string; slug: string }; saved: boolean }

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function SavedJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/jobs/saved', { headers: authHeaders() }).then(async (r) => {
      const d = await r.json();
      if (r.ok) setJobs(d.jobs); else setError(d?.error?.message ?? 'Failed');
    });
  }, []);

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Saved jobs</h1>
        {error && <p className="error-text">{error}</p>}
        {jobs.map((j) => (
          <div key={j.id} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
            <Link href={`/jobs/${j.id}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>{j.title}</Link>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>🏢 {j.company.name}</p>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No saved jobs yet.</p></div>
        )}
      </div>
    </AppShell>
  );
}
