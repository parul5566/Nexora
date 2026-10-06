'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell, ChipRow } from '../../components/shell';
import { Composer, PostCard, type PostView } from '../../components/posts';
import { StoryBar } from '../../components/stories';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function HomePage() {
  const [tab, setTab] = useState<'feed' | 'my-posts' | 'drafts'>('feed');
  const [posts, setPosts] = useState<PostView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<'following' | 'discover'>('following');
  const [me, setMe] = useState<string | null>(null);
  const [myPosts, setMyPosts] = useState<PostView[]>([]);
  const [myCursor, setMyCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMe = useCallback(async (token: string) => {
    const m = await fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (m.ok) setMe((await m.json()).user.username);
  }, []);

  const load = useCallback(async (cursor?: string | null) => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    if (!me) loadMe(token);
    const res = await fetch(`${API}/api/v1/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Failed to load feed'); setLoading(false); return; }
    setPosts((p) => (cursor ? [...p, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
    setMode(data.mode ?? 'following');
    setLoading(false);
  }, [me, loadMe]);

  const loadMyPosts = useCallback(async (cursor?: string | null) => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    const username = me ?? (await (await fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })).json()).user.username;
    const res = await fetch(`${API}/api/v1/users/${username}/posts?drafts=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Failed to load'); return; }
    setMyPosts((p) => (cursor ? [...p, ...data.items] : data.items));
    setMyCursor(data.nextCursor);
  }, [me, loadMe]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (tab !== 'feed' && myPosts.length === 0) loadMyPosts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const refresh = useCallback(() => {
    if (tab === 'feed') load();
    else loadMyPosts();
  }, [tab, load, loadMyPosts]);

  const list = tab === 'feed' ? posts : myPosts;
  const cursor = tab === 'feed' ? nextCursor : myCursor;
  const visible = tab === 'drafts' ? list.filter((p) => p.isDraft) : tab === 'my-posts' ? list.filter((p) => !p.isDraft) : list;

  return (
    <AppShell active="home">
      <StoryBar />
      <Composer onPosted={refresh} />
      <ChipRow
        active={tab}
        onChange={(id) => setTab(id as 'feed' | 'my-posts' | 'drafts')}
        tabs={[
          { id: 'feed', label: mode === 'discover' ? 'For you · Discover' : 'For you' },
          { id: 'my-posts', label: 'My posts' },
          { id: 'drafts', label: 'Drafts' },
        ]}
      />
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && visible.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">
            {tab === 'drafts' ? 'No drafts yet.'
              : tab === 'my-posts' ? 'No posts yet — write your first one above!'
              : mode === 'discover' ? 'Nothing here yet. Follow people to fill your feed!'
              : 'You\u2019re all caught up.'}
          </p>
        </div>
      )}
      {visible.map((p) => <PostCard key={p.id} post={p} onChanged={refresh} />)}
      {cursor && (
        <button
          className="btn btn-secondary" style={{ width: '100%', marginBottom: 24 }}
          onClick={() => (tab === 'feed' ? load(cursor) : loadMyPosts(cursor))}
        >Load more</button>
      )}
    </AppShell>
  );
}
