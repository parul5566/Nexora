'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/shell';

export interface Community {
  id: number; name: string; slug: string; description: string | null;
  privacy: 'public' | 'private'; memberCount: number; myRole: string | null;
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

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'discover' | 'joined'>('discover');

  const load = useCallback(async (q = '') => {
    try {
      const data = await api(`/communities${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setCommunities(data.communities);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setError('');
    try {
      await api('/communities', { method: 'POST', body: JSON.stringify({ name, privacy }) });
      setName('');
      load(search);
    } catch (e: any) { setError(e.message); }
  }

  async function join(slug: string) {
    try { await api(`/communities/${slug}/join`, { method: 'POST' }); load(search); }
    catch (e: any) { setError(e.message); }
  }

  const shown = tab === 'joined' ? communities.filter((c) => c.myRole) : communities;

  const body = (
    <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Groups</h1>
      <div className="chip-row" role="tablist" aria-label="Group filters" style={{ marginBottom: 12 }}>
        <button role="tab" aria-selected={tab === 'discover'} className="chip"
          style={tab === 'discover' ? { background: 'var(--fb-tint)', color: 'var(--fb-blue)' } : undefined}
          onClick={() => setTab('discover')}>Discover</button>
        <button role="tab" aria-selected={tab === 'joined'} className="chip"
          style={tab === 'joined' ? { background: 'var(--fb-tint)', color: 'var(--fb-blue)' } : undefined}
          onClick={() => setTab('joined')}>Your groups</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search groups…" value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} style={{ width: '100%', marginBottom: 10, borderRadius: 999 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <select className="input" style={{ width: 'auto', minHeight: 0, padding: '8px 10px' }} value={privacy} onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 18px' }} onClick={create} disabled={name.trim().length < 2}>Create</button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>
      {shown.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">{tab === 'joined' ? 'You have not joined any groups yet.' : 'No groups found.'}</p>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {shown.map((c) => (
          <Link key={c.id} href={`/communities/${c.slug}`} className="card" style={{ overflow: 'hidden', textDecoration: 'none', color: 'var(--fb-text)', padding: 0 }}>
            <div style={{ height: 100, background: 'linear-gradient(120deg, var(--fb-blue), #7c3aed 90%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>👥</div>
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {c.privacy === 'private' ? '🔒 Private group' : '🌐 Public group'} · {c.memberCount} members
              </div>
              {!c.myRole ? (
                <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10, minHeight: 0, padding: '8px 0', fontWeight: 700 }}
                  onClick={(e) => { e.preventDefault(); join(c.slug); }}>Join group</button>
              ) : (
                <div className="fb-chip" style={{ textAlign: 'center', marginTop: 10, padding: '6px 0' }}>
                  {c.myRole === 'owner' ? '👑 Owner' : c.myRole === 'admin' ? '⚙ Admin' : '✓ Joined'}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return <AppShell active="groups">{body}</AppShell>;
}
