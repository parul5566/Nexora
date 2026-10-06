'use client';

import { useCallback, useEffect, useState } from 'react';
import { Composer, PostCard, type PostView } from '../../../components/posts';
import { AppShell } from '../../../components/shell';

interface CompanyDetail {
  id: number; name: string; slug: string; tagline: string | null; industry: string | null;
  website: string | null; description: string | null; followerCount: number; myRole: string | null;
}

export default function CompanyPage({ slug }: { slug: string }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tagline, setTagline] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobType, setJobType] = useState('full-time');
  const [jobRemote, setJobRemote] = useState(false);

  async function postJob() {
    const res = await fetch(`/api/v1/companies/${slug}/jobs`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title: jobTitle, description: jobDesc, location: jobLocation || undefined, type: jobType, remote: jobRemote }),
    });
    if (res.ok) { setJobTitle(''); setJobDesc(''); setJobLocation(''); setNotice('Job published'); }
    else { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message ?? 'Job post failed'); }
  }

  const authHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const load = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
      const cRes = await fetch(`/api/v1/companies/${slug}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData?.error?.message || 'Not found');
      setCompany(cData.company);
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/v1/companies/${slug}/posts`),
        cData.company.myRole === 'admin' ? fetch(`/api/v1/companies/${slug}/analytics`, { headers: authHeaders() }) : Promise.resolve(null),
      ]);
      if (pRes.ok) setPosts((await pRes.json()).posts);
      if (aRes && aRes.ok) setAnalytics(await aRes.json());
    } catch (e: any) { setError(e.message); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function action(path: string, body?: unknown) {
    const res = await fetch(`/api/v1/companies/${slug}${path}`, {
      method: 'POST', headers: authHeaders(), body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message || 'Failed'); return false; }
    setNotice('');
    return true;
  }

  const shell = (children: React.ReactNode) => (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>{children}</div>
    </AppShell>
  );
  if (error && !company) return shell(<p className="error-text">{error}</p>);
  if (!company) return shell(<p className="muted">Loading…</p>);

  const isAdmin = company.myRole === 'admin';
  const canPost = isAdmin || company.myRole === 'recruiter';

  return shell(
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>{company.name}</h1>
        <p>{company.tagline}</p>
        <p className="muted">{[company.industry, company.website].filter(Boolean).join(' · ')}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{company.followerCount} followers</span>
          {!company.myRole && (
            <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 20px' }} onClick={async () => { if (await action('/follow')) load(); }}>Follow</button>
          )}
          {company.myRole && company.myRole !== 'admin' && (
            <button className="btn btn-secondary" onClick={async () => { if (await action('/unfollow')) load(); }}>Unfollow</button>
          )}
          {company.myRole && <span className="fb-chip">{company.myRole}</span>}
        </div>
        {isAdmin && analytics && (
          <div className="card" style={{ marginTop: 12 }}>
            <h3>Analytics</h3>
            <p>{String(analytics.followers)} followers · {String(analytics.posts)} posts · {String(analytics.reactions)} reactions · {String(analytics.comments)} comments</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Admin</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="New tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={async () => {
              const res = await fetch(`/api/v1/companies/${slug}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ tagline }) });
              if (res.ok) { setTagline(''); load(); } else setNotice('Branding update failed');
            }}>Update branding</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Username to add as recruiter" value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={async () => {
              if (await action('/admins', { username: recruiterName, role: 'recruiter' })) { setRecruiterName(''); setNotice(`@${recruiterName} added as recruiter`); }
            }}>Add recruiter</button>
          </div>
        </div>
      )}

      {canPost && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Post a job</h3>
          <input placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <textarea className="input" rows={3} placeholder="Description" value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="Location" value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} />
            <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
            <label><input type="checkbox" checked={jobRemote} onChange={(e) => setJobRemote(e.target.checked)} /> Remote</label>
          </div>
          <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 20px' }} disabled={!jobTitle.trim() || !jobDesc.trim()} onClick={postJob}>Publish job</button>
        </div>
      )}

      {canPost && <Composer onPosted={() => load()} />}

      {notice && <p className="fb-chip" style={{ marginBottom: 10 }}>{notice}</p>}

      {posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
      {posts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No posts yet.</p></div>}
    </>
  );
}
