'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PostCard, type PostView } from '../../components/posts';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'people' | 'posts' | 'hashtags'>('people');
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/trending/hashtags`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { hashtags: [] })
      .then((d) => setTrending(d.hashtags ?? []));
  }, []);

  useEffect(() => {
    if (!q.trim()) { setSearched(''); return; }
    const t = setTimeout(runSearch, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function runSearch() {
    const term = q.trim();
    if (!term) return;
    const token = localStorage.getItem('nexora_token');
    setLoading(true);
    setSearched(term);
    const headers = { Authorization: `Bearer ${token}` };
    const [u, p, h] = await Promise.all([
      fetch(`${API}/api/v1/search/users?q=${encodeURIComponent(term)}`, { headers }).then((r) => r.ok ? r.json() : { users: [] }),
      fetch(`${API}/api/v1/search/posts?q=${encodeURIComponent(term)}`, { headers }).then((r) => r.ok ? r.json() : { items: [] }),
      fetch(`${API}/api/v1/search/hashtags?q=${encodeURIComponent(term.replace(/^#/, '').toLowerCase())}`, { headers }).then((r) => r.ok ? r.json() : { hashtags: [] }),
    ]);
    setUsers(u.users ?? []);
    setPosts(p.items ?? []);
    setHashtags(h.hashtags ?? []);
    setLoading(false);
  }

  async function follow(username: string) {
    const token = localStorage.getItem('nexora_token');
    const res = await fetch(`${API}/api/v1/follows/${username}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setUsers((us) => us.map((u) => (u.username === username ? { ...u, isFollowing: true, followers: u.followers + 1 } : u)));
  }

  const total = users.length + posts.length + hashtags.length;

  const body = (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <input
        className="input"
        placeholder="Search people, posts, #hashtags…"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12, fontSize: 16, borderRadius: 999, background: 'var(--fb-canvas)', border: 'none', padding: '10px 16px' }}
      />

      {!searched && (
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Trending hashtags</p>
          {trending.length === 0 && <p className="muted">No trends yet.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {trending.map((t) => (
              <Link key={t.tag} href={`/hashtag/${t.tag}`} className="fb-chip">
                #{t.tag} <span style={{ opacity: 0.7 }}>{t.uses}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {([['people', 'People', users.length], ['posts', 'Posts', posts.length], ['hashtags', 'Hashtags', hashtags.length]] as const).map(([key, label, count]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className="chip"
                style={tab === key ? { background: 'var(--fb-tint)', color: 'var(--fb-blue)' } : undefined}
                onClick={() => setTab(key)}
              >{label} ({count})</button>
            ))}
          </div>
          {loading && <p className="muted">Searching…</p>}
          {!loading && total === 0 && <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No results for “{searched}”.</p></div>}

          {!loading && tab === 'people' && users.map((u) => (
            <div key={u.username} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '12px 16px' }}>
              <Link href={`/u/${u.username}`}><Avatar name={u.displayName} src={u.avatarUrl ?? undefined} size={48} /></Link>
              <Link href={`/u/${u.username}`} style={{ fontWeight: 600, color: 'var(--fb-text)', flex: 1 }}>
                {u.displayName} <span className="muted" style={{ fontWeight: 400 }}>@{u.username}</span>
                <div className="muted" style={{ fontSize: 12 }}>{u.followers} followers</div>
              </Link>
              {!u.isFollowing && (
                <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '6px 16px' }} onClick={() => follow(u.username)}>Follow</button>
              )}
            </div>
          ))}

          {!loading && tab === 'posts' && posts.map((p) => <PostCard key={p.id} post={p} />)}

          {!loading && tab === 'hashtags' && hashtags.map((h) => (
            <Link key={h.tag} href={`/hashtag/${h.tag}`} className="card" style={{ display: 'block', marginBottom: 8, padding: '12px 16px', color: 'var(--fb-text)' }}>
              <strong>#{h.tag}</strong> <span className="muted">{h.uses} posts</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );

  return <AppShell active="home">{body}</AppShell>;
}
