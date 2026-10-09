'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/shell';

export interface Company {
  id: number; name: string; slug: string; tagline: string | null; industry: string | null;
  followerCount: number; myRole: string | null;
}

async function api(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  const res = await fetch(`/api/v1${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Request failed');
  return data;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (q = '') => {
    try {
      const data = await api(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setCompanies(data.companies);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setError('');
    try {
      await api('/companies', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      load(search);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Companies</h1>
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <input className="input" placeholder="Search companies…" value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} style={{ width: '100%', marginBottom: 8, borderRadius: 999 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="New company name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 18px' }} onClick={create} disabled={name.trim().length < 2}>Create</button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
      {companies.map((c) => (
        <a key={c.id} href={`/companies/${c.slug}`} className="card" style={{ display: 'block', marginBottom: 10, padding: '12px 16px', color: 'var(--fb-text)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{c.name}</strong>
            {c.myRole && <span className="fb-chip">{c.myRole}</span>}
          </div>
          <p style={{ margin: '6px 0', fontSize: 14 }}>{c.tagline}</p>
          <span className="muted" style={{ fontSize: 13 }}>{c.followerCount} followers{c.industry ? ` · ${c.industry}` : ''}</span>
        </a>
      ))}
      {companies.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No companies yet.</p></div>
      )}
      </div>
    </AppShell>
  );
}
