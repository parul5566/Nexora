'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/shell';

export interface Job {
  id: number; title: string; description: string; location: string | null;
  type: string; remote: boolean; saved: boolean;
  company: { id: number; name: string; slug: string };
  myApplicationStatus: string | null;
}

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (location) params.set('location', location);
    if (remote) params.set('remote', '1');
    try {
      const res = await fetch(`/api/v1/jobs?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Failed');
      setJobs(data.jobs);
    } catch (e: any) { setError(e.message); }
  }, [q, type, location, remote]);

  useEffect(() => { load(); }, [load]);

  async function save(jobId: number, saved: boolean) {
    await fetch(`/api/v1/jobs/${jobId}/save`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ saved }) });
    load();
  }

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Jobs</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/jobs/saved" className="fb-chip">Saved</Link>
          <Link href="/jobs/applications" className="fb-chip">My applications</Link>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" placeholder="🔍 Search title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 140, borderRadius: 999 }} />
          <input className="input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
          <select className="input" style={{ width: 'auto', minHeight: 0, padding: '8px 10px' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
          <label className="chip" style={{ cursor: 'pointer', background: remote ? 'var(--fb-tint)' : undefined, color: remote ? 'var(--fb-blue)' : undefined }}>
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} hidden /> Remote
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
      {jobs.map((j) => (
        <div key={j.id} className="card" style={{ marginBottom: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Link href={`/jobs/${j.id}`} style={{ fontWeight: 600, color: 'var(--fb-text)', fontSize: 16 }}>{j.title}</Link>
            <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => save(j.id, !j.saved)}>{j.saved ? '★ Saved' : '☆ Save'}</button>
          </div>
          <p style={{ margin: '6px 0', fontSize: 14 }}>{j.description}</p>
          <span className="muted" style={{ fontSize: 13 }}>
            🏢 {j.company.name} · 📍 {j.location ?? 'Anywhere'} · {j.type}{j.remote ? ' · Remote' : ''}
            {j.myApplicationStatus ? ` · You: ${j.myApplicationStatus}` : ''}
          </span>
        </div>
      ))}
      {jobs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No jobs match your filters.</p></div>
      )}
      </div>
    </AppShell>
  );
}
