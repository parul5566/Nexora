'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Reel {
  id: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  videoUrl: string;
  caption: string | null;
  views: number;
  likes: number;
  liked: boolean;
  createdAt?: string;
}

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor?: string | null) => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    const res = await fetch(`${API}/api/v1/reels${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setReels((r) => (cursor ? [...r, ...data.reels] : data.reels));
    setNextCursor(data.nextCursor ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function like(id: string) {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/reels/${id}/like`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { reel } = await res.json();
      setReels((rs) => rs.map((r) => (r.id === id ? { ...r, liked: reel.liked, likes: reel.likes } : r)));
    }
  }

  async function upload() {
    if (!file) return;
    setError('');
    setUploading(true);
    const token = localStorage.getItem('nexora_token')!;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(`${API}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const ud = await up.json();
      if (!up.ok) throw new Error(ud?.error?.message ?? 'Upload failed');
      const res = await fetch(`${API}/api/v1/reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl: ud.media.url, caption }),
      });
      const rd = await res.json();
      if (!res.ok) throw new Error(rd?.error?.message ?? 'Failed to create reel');
      setCaption(''); setFile(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell active="watch">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Watch</h1>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Create a reel</p>
        <label className="composer-action" style={{ background: 'var(--fb-canvas)', borderRadius: 8, marginBottom: 8, display: 'flex' }}>
          <span style={{ fontSize: 18 }}>🎬</span> Choose video (MP4/WebM)
          <input
            type="file" accept="video/mp4,video/webm,video/quicktime" hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading}
          />
        </label>
        {file && <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{file.name}</p>}
        <input className="input" placeholder="Caption (max 500)" value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} disabled={uploading} style={{ marginBottom: 8, borderRadius: 999 }} />
        <button className="btn btn-primary btn-pill" onClick={upload} disabled={!file || uploading} style={{ minHeight: 0, padding: '8px 20px' }}>
          {uploading ? 'Uploading…' : 'Publish reel'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && reels.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">No reels yet — publish the first one above!</p>
        </div>
      )}
      {reels.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 10, padding: 12, alignItems: 'center' }}>
            <Link href={`/u/${r.author.username}`}>
              <Avatar src={r.author.avatarUrl} name={r.author.displayName} size={40} />
            </Link>
            <div>
              <Link href={`/u/${r.author.username}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>{r.author.displayName}</Link>
              <div className="muted" style={{ fontSize: 12 }}>{r.views} views</div>
            </div>
          </div>
          {r.videoUrl && (
            <video src={r.videoUrl} controls playsInline style={{ width: '100%', maxHeight: 520, background: '#000' }} />
          )}
          <div style={{ padding: '10px 12px', display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="post-action" onClick={() => like(r.id)} style={r.liked ? { color: 'var(--fb-blue)' } : undefined}>
              <span style={{ fontSize: 16 }}>{r.liked ? '❤️' : '🤍'}</span> {r.likes}
            </button>
            {r.caption && <span style={{ marginLeft: 8, fontSize: 14 }}>{r.caption}</span>}
          </div>
        </div>
      ))}
      {nextCursor && (
        <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 24 }} onClick={() => load(nextCursor)}>Load more</button>
      )}
      </div>
    </AppShell>
  );
}
