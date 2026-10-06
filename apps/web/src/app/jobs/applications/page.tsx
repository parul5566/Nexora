'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../../components/shell';

interface Application { id: number; jobTitle: string; jobId: number; company: string; status: string }

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'var(--fb-text-secondary)',
  viewed: 'var(--fb-blue)',
  rejected: '#E41E3F',
  hired: '#45BD62',
};

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/jobs/applications', { headers: authHeaders() }).then(async (r) => {
      const d = await r.json();
      if (r.ok) setApplications(d.applications); else setError(d?.error?.message ?? 'Failed');
    });
  }, []);

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>My applications</h1>
        {error && <p className="error-text">{error}</p>}
        {applications.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 10, padding: '12px 16px' }}>
            <Link href={`/jobs/${a.jobId}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>{a.jobTitle}</Link>
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>
              <span className="muted">{a.company} · </span>
              <span style={{ color: STATUS_COLORS[a.status] ?? 'var(--fb-text-secondary)', fontWeight: 600 }}>{a.status}</span>
            </p>
          </div>
        ))}
        {applications.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">You have not applied to any jobs yet.</p></div>
        )}
      </div>
    </AppShell>
  );
}
