'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../../components/shell';

interface Job {
  id: number; title: string; description: string; location: string | null;
  type: string; remote: boolean; saved: boolean;
  company: { id: number; name: string; slug: string };
  myApplicationStatus: string | null;
}

interface Applicant { id: number; username: string; displayName: string; profileUrl: string; status: string; coverLetter: string | null }

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function JobDetailPage({ id }: { id: string }) {
    const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/jobs/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Not found');
      setJob(data.job);
      const aRes = await fetch(`/api/v1/jobs/${id}/applicants`, { headers: authHeaders() });
      if (aRes.ok) setApplicants((await aRes.json()).applicants);
    } catch (e: any) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function apply() {
    setNotice('');
    const res = await fetch(`/api/v1/jobs/${id}/apply`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ coverLetter }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setNotice('Application submitted'); setCoverLetter(''); load(); }
    else setNotice(data?.error?.message ?? 'Failed to apply');
  }

  async function setStatus(appId: number, status: string) {
    await fetch(`/api/v1/applications/${appId}/status`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }),
    });
    load();
  }

  const shell = (children: React.ReactNode) => (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>{children}</div>
    </AppShell>
  );
  if (error) return shell(<p className="error-text">{error}</p>);
  if (!job) return shell(<p className="muted">Loading…</p>);

  return shell(
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>{job.title}</h1>
        <p className="muted">
          <Link href={`/companies/${job.company.slug}`}>{job.company.name}</Link> · {job.location ?? 'Anywhere'} · {job.type}{job.remote ? ' · Remote' : ''}
        </p>
        <p>{job.description}</p>
        {job.myApplicationStatus
          ? <p className="fb-chip">Your application: {job.myApplicationStatus}</p>
          : (
            <div>
              <textarea className="input" rows={4} placeholder="Cover letter (optional)" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
              <button className="btn btn-primary btn-pill" onClick={apply} style={{ marginTop: 8, minHeight: 0, padding: '8px 20px' }}>Apply</button>
            </div>
          )}
        {notice && <p className="fb-chip" style={{ marginTop: 8 }}>{notice}</p>}
      </div>

      {applicants && (
        <div className="card">
          <h2>Applicants ({applicants.length})</h2>
          {applicants.map((a) => (
            <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <Link href={a.profileUrl}><strong>{a.displayName}</strong></Link> <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px' }}>{a.status}</span>
              {a.coverLetter ? <p>{a.coverLetter}</p> : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setStatus(a.id, 'viewed')}>Viewed</button>
                <button className="btn btn-secondary" onClick={() => setStatus(a.id, 'rejected')}>Reject</button>
                <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => setStatus(a.id, 'hired')}>Hire</button>
              </div>
            </div>
          ))}
          {applicants.length === 0 && <p className="muted">No applicants yet.</p>}
        </div>
      )}
    </>
  );
}
