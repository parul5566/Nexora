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
  const [posting, setPosting] = useState(false);
  const [myCompanies, setMyCompanies] = useState<Array<{ slug: string; name: string; myRole: string | null }>>([]);
  const [form, setForm] = useState({ companySlug: '', title: '', description: '', location: '', type: 'full-time', remote: false });
  const [postMsg, setPostMsg] = useState('');

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
  useEffect(() => {
    fetch('/api/v1/companies?limit=50', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { companies: [] }))
      .then((d) => setMyCompanies((d.companies ?? []).filter((c: any) => c.myRole)))
      .catch(() => {});
  }, []);

  async function postJob() {
    setPostMsg(''); setError('');
    const res = await fetch(`/api/v1/companies/${form.companySlug}/jobs`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title: form.title, description: form.description, location: form.location || undefined, type: form.type, remote: form.remote }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setPostMsg(data?.error?.message ?? 'Failed to post job'); return; }
    setPostMsg('✓ Job posted');
    setForm((f) => ({ ...f, title: '', description: '', location: '' }));
    setPosting(false);
    load();
  }

  async function save(jobId: number, saved: boolean) {
    await fetch(`/api/v1/jobs/${jobId}/save`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ saved }) });
    load();
  }

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>🧑‍💼 Jobs</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {myCompanies.length > 0 && (
            <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '6px 16px' }} onClick={() => setPosting((p) => !p)}>+ Post a job</button>
          )}
          <Link href="/jobs/saved" className="fb-chip">★ Saved</Link>
          <Link href="/jobs/applications" className="fb-chip">My applications</Link>
        </div>
      </div>
      {postMsg && <div className="card" style={{ padding: '8px 14px', marginBottom: 10, color: 'var(--fb-blue)' }}>{postMsg}</div>}
      {posting && myCompanies.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
          <p style={{ fontWeight: 700, margin: '0 0 10px' }}>Post a job</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <select className="input" value={form.companySlug} onChange={(e) => setForm((f) => ({ ...f, companySlug: e.target.value }))}>
              <option value="">Choose company…</option>
              {myCompanies.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.myRole})</option>)}
            </select>
            <input className="input" placeholder="Job title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} style={{ flex: 1, minWidth: 120 }} />
              <select className="input" style={{ width: 'auto' }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
              <label className="chip" style={{ cursor: 'pointer', background: form.remote ? 'var(--fb-tint)' : undefined, color: form.remote ? 'var(--fb-blue)' : undefined }}>
                <input type="checkbox" checked={form.remote} onChange={(e) => setForm((f) => ({ ...f, remote: e.target.checked }))} hidden /> Remote
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 20px' }} disabled={!form.companySlug || !form.title.trim() || !form.description.trim()} onClick={postJob}>Publish job</button>
              <button className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px' }} onClick={() => setPosting(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
        <div key={j.id} className="card" style={{ marginBottom: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #0a66c2, #0084ff)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
              }}>{j.company.name.charAt(0)}</div>
              <div style={{ minWidth: 0 }}>
                <Link href={`/jobs/${j.id}`} style={{ fontWeight: 700, color: '#0a66c2', fontSize: 16 }}>{j.title}</Link>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{j.company.name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  📍 {j.location ?? 'Anywhere'}{j.remote ? ' · Remote' : ''} · {j.type}
                </div>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => save(j.id, !j.saved)}>{j.saved ? '★ Saved' : '☆ Save'}</button>
          </div>
          <p style={{ margin: '10px 0 8px', fontSize: 14 }}>{j.description}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {j.myApplicationStatus ? (
              <span className="fb-chip">✓ Applied · {j.myApplicationStatus}</span>
            ) : (
              <ApplyInline jobId={j.id} onApplied={load} />
            )}
          </div>
        </div>
      ))}
      {jobs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No jobs match your filters.</p></div>
      )}
      </div>
    </AppShell>
  );
}

function ApplyInline({ jobId, onApplied }: { jobId: number; onApplied: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function apply() {
    setBusy(true);
    const res = await fetch(`/api/v1/jobs/${jobId}/apply`, { method: 'POST', headers: authHeaders(), body: '{}' });
    setBusy(false);
    if (res.ok) { setDone(true); onApplied(); }
  }
  if (done) return <span className="fb-chip">✓ Applied</span>;
  return (
    <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '7px 20px', background: '#0a66c2', border: 'none' }} onClick={apply} disabled={busy}>
      {busy ? 'Applying…' : 'Apply now'}
    </button>
  );
}
