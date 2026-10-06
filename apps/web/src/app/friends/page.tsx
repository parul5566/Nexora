'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Tab = 'requests' | 'followers' | 'following';

interface Person {
  id?: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('requests');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user.username))
      .catch(() => {});
  }, []);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setMessage('');
    const token = localStorage.getItem('nexora_token');
    if (!token || !me) return;
    if (t === 'requests') {
      const res = await fetch(`${API}/api/v1/connections/requests/incoming`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPeople((await res.json()).requests ?? []);
      else setPeople([]);
    } else if (me) {
      const res = await fetch(`${API}/api/v1/follows/${me}/${t}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPeople((data.items ?? []).map((u: any) => ({
          username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl,
        })));
      } else setPeople([]);
    }
    setLoading(false);
  }, [me]);

  useEffect(() => { if (me) load(tab); }, [tab, me, load]);

  async function accept(username: string) {
    setBusy(username);
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/connections/${username}/accept`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    setBusy(null);
    if (res.ok) { setMessage(`You and ${username} are now connected.`); load(tab); }
    else { const e = await res.json().catch(() => ({})); setMessage(e?.error?.message ?? 'Failed to accept'); }
  }

  async function reject(username: string) {
    setBusy(username);
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/connections/${username}/reject`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    setBusy(null);
    if (res.ok) load(tab);
  }

  const body = (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Friends</h1>
      <div className="chip-row" role="tablist" aria-label="Friend lists" style={{ marginBottom: 12 }}>
        {([['requests', 'Requests'], ['followers', 'Followers'], ['following', 'Following']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="chip"
            style={tab === key ? { background: 'var(--fb-tint)', color: 'var(--fb-blue)' } : undefined}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>
      {message && <div className="card" style={{ padding: '10px 16px', marginBottom: 10, color: 'var(--fb-blue)' }}>{message}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && people.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">
            {tab === 'requests' ? 'No pending friend requests.' : tab === 'followers' ? 'No followers yet.' : 'You are not following anyone yet.'}
          </p>
        </div>
      )}
      {people.map((p) => (
        <div key={p.username} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '12px 16px' }}>
          <Link href={`/u/${p.username}`}><Avatar name={p.displayName} src={p.avatarUrl ?? undefined} size={52} /></Link>
          <div style={{ flex: 1 }}>
            <Link href={`/u/${p.username}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>{p.displayName}</Link>
            <div className="muted" style={{ fontSize: 13 }}>@{p.username}</div>
          </div>
          {tab === 'requests' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '6px 16px' }} disabled={busy === p.username} onClick={() => accept(p.username)}>Confirm</button>
              <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 16px' }} disabled={busy === p.username} onClick={() => reject(p.username)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return <AppShell active="friends">{body}</AppShell>;
}
