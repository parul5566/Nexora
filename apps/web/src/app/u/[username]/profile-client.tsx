'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PostCard, type PostView } from '../../../components/posts';
import { AppShell, Avatar } from '../../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  headline: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  followerCount: number;
  followingCount: number;
  isSelf: boolean;
  relationship?: { following?: boolean; connectionState?: string | null };
};

type Tab = 'posts' | 'about' | 'friends';

export default function ProfileClient({ username }: { username: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [friends, setFriends] = useState<Array<{ username: string; displayName: string; avatarUrl: string | null }>>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) router.replace('/login');
  }, [router]);

  const load = useCallback(async () => {
    const token = localStorage.getItem('nexora_token');
    const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch(`${API}/api/v1/users/${username}`, { headers: auth });
      if (!res.ok) throw new Error('Profile not found');
      const data = await res.json();
      setProfile(data.profile);
      const postsRes = await fetch(`${API}/api/v1/users/${encodeURIComponent(username)}/posts`, { headers: auth });
      if (postsRes.ok) {
        const pd = await postsRes.json();
        setPosts(pd.items ?? []);
      } else {
        setPosts([]);
      }
      const frRes = await fetch(`${API}/api/v1/follows/${encodeURIComponent(username)}/followers`, { headers: auth });
      if (frRes.ok) {
        const fd = await frRes.json();
        setFriends((fd.items ?? []).slice(0, 9));
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load profile');
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try {
      const following = profile.relationship?.following;
      await fetch(`${API}/api/v1/follows/${username}`, {
        method: following ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('nexora_token')}` },
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!profile) return;
    setBusy(true);
    try {
      const state = profile.relationship?.connectionState;
      if (state === 'pending' || state === 'accepted') {
        await fetch(`${API}/api/v1/connections/${username}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('nexora_token')}` },
        });
      } else {
        await fetch(`${API}/api/v1/connections/${username}/request`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('nexora_token')}` },
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppShell active="menu">
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', paddingTop: 40 }}>
          <p className="muted">{error}</p>
          <Link href="/home" className="btn btn-secondary">Back home</Link>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell active="menu">
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', paddingTop: 40 }}>
          <p className="muted">Loading profile…</p>
        </div>
      </AppShell>
    );
  }

  const isFollowing = !!profile.relationship?.following;
  const conn = profile.relationship?.connectionState;

  const header = (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
      <div
        style={{
          height: 140,
          background: profile.coverUrl ? `url(${profile.coverUrl}) center/cover` : 'linear-gradient(120deg, #1877F2, #45BD62)',
        }}
      />
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ marginTop: -40 }}>
            <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={120} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 0' }}>
            {profile.isSelf ? (
              <>
                <Link href="/settings/profile" className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 20px' }}>Edit profile</Link>
                <Link href="/settings/profile" className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px' }}>⚙ Settings</Link>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 20px' }} onClick={toggleFollow} disabled={busy}>
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
                <button className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px' }} onClick={connect} disabled={busy}>
                  {conn === 'accepted' ? '✓ Connected' : conn === 'pending' ? 'Requested' : 'Connect'}
                </button>
              </>
            )}
          </div>
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26 }}>{profile.displayName}</h1>
        <p className="muted" style={{ margin: '2px 0' }}>@{profile.username}</p>
        {profile.headline && <p style={{ margin: '6px 0', fontWeight: 500 }}>{profile.headline}</p>}
        {profile.bio && <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{profile.bio}</p>}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 15 }}>
          <span><strong>{profile.followerCount}</strong> <span className="muted">followers</span></span>
          <span><strong>{profile.followingCount}</strong> <span className="muted">following</span></span>
        </div>
      </div>
      <div className="chip-row" style={{ borderTop: '1px solid var(--fb-border)', padding: '0 12px', margin: 0 }}>
        {([['posts', 'Posts'], ['about', 'About'], ['friends', 'Friends']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="chip"
            style={{
              borderRadius: 0, background: 'transparent', border: 'none', borderBottom: tab === key ? '3px solid var(--fb-blue)' : '3px solid transparent',
              color: tab === key ? 'var(--fb-blue)' : 'var(--fb-text-secondary)',
            }}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>
    </div>
  );

  const body = (
    <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {header}
      {tab === 'posts' && (
        <section>
          {posts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No posts yet.</p></div>}
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChanged={load} />
          ))}
        </section>
      )}
      {tab === 'about' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About</h2>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 10, fontSize: 14 }}>
            <dt className="muted">Bio</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{profile.bio ?? '—'}</dd>
            <dt className="muted">Headline</dt><dd style={{ margin: 0 }}>{profile.headline ?? '—'}</dd>
            <dt className="muted">Location</dt><dd style={{ margin: 0 }}>📍 {profile.location ?? '—'}</dd>
            <dt className="muted">Website</dt>
            <dd style={{ margin: 0 }}>{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a> : '—'}</dd>
            <dt className="muted">Username</dt><dd style={{ margin: 0 }}>@{profile.username}</dd>
          </dl>
        </div>
      )}
      {tab === 'friends' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Friends</h2>
          {friends.length === 0 && <p className="muted">No friends to show yet.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {friends.map((f) => (
              <Link key={f.username} href={`/u/${f.username}`} className="card" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: 'var(--fb-text)' }}>
                <Avatar name={f.displayName} src={f.avatarUrl ?? undefined} size={72} />
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>{f.displayName}</div>
                <div className="muted" style={{ fontSize: 12 }}>@{f.username}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return <AppShell active="menu">{body}</AppShell>;
}
