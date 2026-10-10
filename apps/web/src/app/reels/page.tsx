'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Reel {
  id: string;
  author: { username: string; displayName: string; avatarUrl: string | null; isFollowing?: boolean };
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Instagram-style: the MOST visible reel is the single playing one
  useEffect(() => {
    const root = feedRef.current;
    if (!root || reels.length === 0) return;
    const ratios = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.reelId;
          if (id) ratios.set(id, e.intersectionRatio);
        }
        let best: { id: string; r: number } | null = null;
        for (const [id, r] of ratios) if (!best || r > best.r) best = { id, r };
        if (best && best.r > 0.55) setActiveId(best.id);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    root.querySelectorAll<HTMLElement>('[data-reel-id]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reels]);

  // Autoplay the first reel on load
  useEffect(() => {
    if (reels.length > 0 && activeId === null) setActiveId(reels[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels]);

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

  async function registerView(id: string) {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    await fetch(`${API}/api/v1/reels/${id}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }

  async function like(id: string) {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/reels/${id}/like`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const reel = data?.reel ?? data;
      if (reel && typeof reel.likes === 'number') {
        setReels((rs) => rs.map((r) => (r.id === id ? { ...r, liked: !!reel.liked, likes: reel.likes } : r)));
      }
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
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
      {/* FB Reels-style header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 800 }}>🎬 Reels</h1>
        <label className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 18px', cursor: 'pointer' }}>
          + Create
          <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={uploading} />
        </label>
      </div>

      {file && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>New reel · {file.name}</p>
          <input className="input" placeholder="Caption (max 500)" value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} disabled={uploading} style={{ marginBottom: 8, borderRadius: 999 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-pill" onClick={upload} disabled={uploading} style={{ minHeight: 0, padding: '8px 20px' }}>
              {uploading ? 'Uploading…' : 'Publish reel'}
            </button>
            <button className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px' }} onClick={() => setFile(null)} disabled={uploading}>Cancel</button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && reels.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">No reels yet — publish the first one!</p>
        </div>
      )}

      {/* Instagram-style vertical snap feed: one video plays at a time */}
      <div
        ref={feedRef}
        style={{
          height: 'calc(100dvh - 140px)', overflowY: 'auto', scrollSnapType: 'y mandatory',
          borderRadius: 12, scrollbarWidth: 'none', overscrollBehaviorY: 'contain',
          scrollBehavior: 'smooth',
        }}
      >
        {reels.map((r) => (
          <ReelItem key={r.id} reel={r} active={r.id === activeId} onLike={like} onView={registerView} data-reel-id={r.id} />
        ))}
        {nextCursor && (
          <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 24 }} onClick={() => load(nextCursor)}>Load more</button>
        )}
      </div>
      </div>
    </AppShell>
  );
}

function ReelItem({ reel, active, onLike, onView, ...rest }: { reel: Reel; active: boolean; onLike: (id: string) => void; onView: (id: string) => void; 'data-reel-id': string }) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef(false);

  // Register a view the first time this reel becomes visible
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > 0.6 && !viewedRef.current) {
          viewedRef.current = true;
          onView(reel.id);
        }
      }
    }, { threshold: [0.6] });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reel.id]);

  // ONE video at a time: pause when not the active reel; play (muted) when it becomes active
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.currentTime = el.currentTime; // resume where it was
      const p = el.play();
      if (p) p.catch(() => { /* autoplay blocked — user must tap play/unmute */ });
    } else {
      el.pause();
    }
  }, [active]);

  return (
    <div {...rest} style={{ position: 'relative', scrollSnapAlign: 'start', marginBottom: 12, borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 380 }}>
      {reel.videoUrl && (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          autoPlay={false}
          muted={muted} loop playsInline
          controls
          preload={active ? 'auto' : 'metadata'}
          onDoubleClick={() => onLike(reel.id)}
          style={{ width: '100%', height: 'min(78dvh, 720px)', objectFit: 'contain', background: '#000' }}
        />
      )}
      {/* overlay: author + follow, caption */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 14px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,.75))',
        color: '#fff', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href={`/u/${reel.author.username}`}><Avatar src={reel.author.avatarUrl} name={reel.author.displayName} size={36} /></Link>
            <Link href={`/u/${reel.author.username}`} style={{ fontWeight: 700, color: '#fff' }}>{reel.author.displayName}</Link>
          </div>
          {reel.caption && <p style={{ margin: '6px 0 0', fontSize: 14, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{reel.caption}</p>}
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>{reel.views} views</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '6px 16px' }} onClick={() => onLike(reel.id)}>
            {reel.liked ? '❤️ Liked' : '🤍 Like'} · {reel.likes}
          </button>
          <FollowInline username={reel.author.username} isFollowing={!!reel.author.isFollowing} />
          <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 12px' }} onClick={() => setMuted((m) => !m)}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FollowInline({ username, isFollowing }: { username: string; isFollowing: boolean }) {
  const [following, setFollowing] = useState(isFollowing);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  useEffect(() => {
    setToken(localStorage.getItem('nexora_token'));
    try {
      const me = JSON.parse(localStorage.getItem('nexora_user') || 'null');
      setIsSelf(me?.username === username);
    } catch { setIsSelf(false); }
  }, [username]);
  if (isSelf) return null;
  async function toggle() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/follows/${username}`, {
      method: following ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setBusy(false);
    if (res.ok) setFollowing((f) => !f);
  }
  return (
    <button className={following ? 'btn btn-secondary' : 'btn btn-primary btn-pill'} style={{ minHeight: 0, padding: '6px 14px' }} onClick={toggle} disabled={busy}>
      {following ? '✓ Following' : '+ Follow'}
    </button>
  );
}
