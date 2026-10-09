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
  postsCount?: number;
  relationship?: { following?: boolean; connectionState?: string | null };
};

type Tab = 'posts' | 'about' | 'friends' | 'followers' | 'following';

/** Backend returns relationshipState as a STRING; normalize for the UI. */
function normalizeRelationship(rel: unknown): { isFollowing: boolean; conn: string | null } {
  if (typeof rel === 'string') {
    return {
      isFollowing: rel === 'following' || rel === 'mutuals',
      conn:
        rel === 'connected'
          ? 'accepted'
          : rel === 'pending_outgoing'
            ? 'pending_outgoing'
            : rel === 'pending_incoming'
              ? 'pending_incoming'
              : null,
    };
  }
  const r = (rel ?? {}) as { following?: boolean; connectionState?: string | null };
  return { isFollowing: !!r.following, conn: r.connectionState ?? null };
}

export default function ProfileClient({ username }: { username: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [friends, setFriends] = useState<Array<{ username: string; displayName: string; avatarUrl: string | null }>>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rel, setRel] = useState<{ isFollowing: boolean; conn: string | null }>({ isFollowing: false, conn: null });

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
      setRel(normalizeRelationship(data.profile?.relationship ?? data.relationship));
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
      await fetch(`${API}/api/v1/follows/${username}`, {
        method: rel.isFollowing ? 'DELETE' : 'POST',
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
      // pending_incoming can only be resolved from the Friends screen; don't cancel it here.
      if (rel.conn === 'accepted' || rel.conn === 'pending_outgoing') {
        await fetch(`${API}/api/v1/connections/${username}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('nexora_token')}` },
        });
      } else if (rel.conn === null) {
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

  const isFollowing = rel.isFollowing;
  const conn = rel.conn;

  const header = (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 16, padding: 0 }}>
      <div
        style={{
          height: 160,
          margin: -16,
          marginBottom: 0,
          padding: 0,
          width: 'calc(100% + 32px)',
          background: profile.coverUrl ? `url(${profile.coverUrl}) center/cover` : 'linear-gradient(120deg, #1877F2, #45BD62)',
        }}
      />
      <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginTop: -52, border: '4px solid var(--fb-canvas)', borderRadius: '50%', background: 'var(--fb-surface)', lineHeight: 0 }}>
            <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={112} />
          </div>
          <h1 style={{ margin: '10px 0 0', fontSize: 24 }}>{profile.displayName}</h1>
          <p className="muted" style={{ margin: '2px 0' }}>@{profile.username}</p>
          <div style={{ display: 'flex', gap: 16, margin: '4px 0 2px', fontSize: 15, justifyContent: 'center' }}>
            <span><strong>{profile.followerCount}</strong> <span className="muted">{profile.followerCount === 1 ? 'follower' : 'followers'}</span></span>
            <span>·</span>
            <span><strong>{profile.followingCount}</strong> <span className="muted">following</span></span>
            {typeof profile.postsCount === 'number' && profile.postsCount > 0 && (
              <>
                <span>·</span>
                <span><strong>{profile.postsCount}</strong> <span className="muted">posts</span></span>
              </>
            )}
          </div>
        </div>
        {profile.headline && <p style={{ margin: '8px 0 0', fontWeight: 500 }}>{profile.headline}</p>}
        {profile.bio && <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{profile.bio}</p>}
        <div style={{ display: 'flex', gap: 8, padding: '12px 0 4px', width: '100%' }}>
          {profile.isSelf ? (
            <>
              <a className="btn" style={{ flex: 1 }} href="/home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
              Add to story
            </a>
              <Link href="/settings/profile" className="btn btn-secondary" style={{ flex: 1 }}>✏️ Edit profile</Link>
            </>
          ) : (
            <>
              <button className="btn" style={{ flex: 1 }} onClick={toggleFollow} disabled={busy}>
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={connect} disabled={busy || conn === 'pending_incoming'}>
                {conn === 'accepted' ? '✓ Connected' : conn === 'pending_outgoing' ? 'Requested' : conn === 'pending_incoming' ? 'Respond on Friends' : 'Connect'}
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--fb-border)', padding: '0 12px', margin: 0, display: 'flex', flexWrap: 'nowrap', overflowX: 'auto' }}>
        {([['posts', 'Posts'], ['about', 'About'], ['friends', 'Friends'], ['followers', 'Followers'], ['following', 'Following']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="chip"
            style={{
              flexShrink: 0,
              borderRadius: 0, background: 'transparent', border: 'none', borderBottom: tab === key ? '3px solid var(--fb-blue)' : '3px solid transparent',
              color: tab === key ? 'var(--fb-blue-link, #4599FF)' : 'var(--fb-text-secondary)',
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
      {(tab === 'followers' || tab === 'following') && (
        <FollowList username={username} kind={tab} onChanged={load} />
      )}
    </div>
  );

  return <AppShell active="menu">{body}</AppShell>;
}

function FollowList({ username, kind, onChanged }: { username: string; kind: 'followers' | 'following'; onChanged: () => void }) {
  const [items, setItems] = useState<Array<{ username: string; displayName: string; avatarUrl: string | null; isFollowing?: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/v1/follows/${encodeURIComponent(username)}/${kind}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [username, kind]);

  async function toggle(u: string, following: boolean) {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    await fetch(`${API}/api/v1/follows/${u}`, {
      method: following ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setItems((prev) => prev.map((x) => (x.username === u ? { ...x, isFollowing: !following } : x)));
    onChanged();
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (items.length === 0)
    return <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p></div>;
  return (
    <div>
      {items.map((p) => (
        <div key={p.username} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '12px 16px' }}>
          <Link href={`/u/${p.username}`}><Avatar name={p.displayName} src={p.avatarUrl ?? undefined} size={52} /></Link>
          <div style={{ flex: 1 }}>
            <Link href={`/u/${p.username}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>{p.displayName}</Link>
            <div className="muted" style={{ fontSize: 13 }}>@{p.username}</div>
          </div>
          <button
            className={p.isFollowing ? 'btn btn-secondary' : 'btn btn-primary btn-pill'}
            style={{ minHeight: 0, padding: '6px 16px' }}
            onClick={() => toggle(p.username, !!p.isFollowing)}
          >{p.isFollowing ? '✓ Following' : '+ Follow'}</button>
        </div>
      ))}
    </div>
  );
}
