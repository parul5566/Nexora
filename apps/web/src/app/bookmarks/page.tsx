'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '../../components/shell';
import { PostCard, type PostView } from '../../components/posts';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function BookmarksPage() {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cursor?: string | null) => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    const res = await fetch(`${API}/api/v1/bookmarks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setPosts((p) => (cursor ? [...p, ...data.items] : data.items));
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <AppShell active="saved">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Saved posts</h1>
      </div>
      {loading && <p className="muted">Loading…</p>}
      {!loading && posts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">Nothing saved yet. Tap ☆ Save on any post to keep it here.</p>
        </div>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} onChanged={() => load()} />)}
      {nextCursor && (
        <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 24 }} onClick={() => load(nextCursor)}>Load more</button>
      )}
      </div>
    </AppShell>
  );
}
