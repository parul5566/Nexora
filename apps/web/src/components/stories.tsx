'use client';

import { useEffect, useState, useCallback } from 'react';
import { Avatar } from './shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Story { id: string; mediaUrl: string | null; bgText: string | null; bgColor: string; createdAt?: string; seen: boolean; author?: any; }
interface Group { author: { username: string; displayName: string; avatarUrl: string | null }; stories: Story[]; allSeen: boolean; isSelf: boolean; }

export function StoryBar({ onPosted }: { onPosted?: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ group: Group; index: number } | null>(null);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [uploading, setUploading] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    const [f, m] = await Promise.all([
      fetch(`${API}/api/v1/stories/feed`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (f.ok) setGroups((await f.json()).groups);
    if (m.ok) setMe((await m.json()).user.username);
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function createText() {
    if (!text.trim()) return;
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bgText: text, bgColor: color }),
    });
    if (res.ok) { setText(''); setCreating(false); load(); onPosted?.(); }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const token = localStorage.getItem('nexora_token')!;
    const fd = new FormData();
    fd.append('file', file);
    const up = await fetch(`${API}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (up.ok) {
      const media = (await up.json()).media;
      await fetch(`${API}/api/v1/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl: media.resizedUrl || media.url }),
      });
      setCreating(false);
      load();
      onPosted?.();
    }
    setUploading(false);
  }

  async function view(storyId: string) {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/stories/${storyId}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => load());
  }

  const self = groups.find((g) => g.isSelf);
  const others = groups.filter((g) => !g.isSelf);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        <div style={{
          textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12,
          overflow: 'hidden', position: 'relative', background: 'var(--fb-surface)', border: '1px solid var(--fb-border)',
        }} onClick={() => setCreating(true)}>
          <div style={{ height: 130, background: '#E8EAED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>＋</div>
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 4px' }}>Create story</div>
        </div>
        {self && (
          <div key="self" style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
            onClick={() => setViewing({ group: self, index: 0 })}>
            {self.stories[0]?.mediaUrl
              ? // eslint-disable-next-line @next/next/no-img-element
              <img src={self.stories[0].mediaUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ position: 'absolute', inset: 0, background: self.stories[0]?.bgColor ?? '#1877F2' }} />}
            <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: '50%', border: self.allSeen ? '2px solid #fff' : '3px solid var(--fb-blue)' }}>
              <Avatar name={self.author.displayName} src={self.author.avatarUrl ?? undefined} size={36} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, color: '#fff', fontSize: 12, fontWeight: 600, padding: '14px 6px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>You</div>
          </div>
        )}
        {others.map((g) => (
          <div key={g.author.username} style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
            onClick={() => setViewing({ group: g, index: 0 })}>
            {g.stories[0]?.mediaUrl
              ? // eslint-disable-next-line @next/next/no-img-element
              <img src={g.stories[0].mediaUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ position: 'absolute', inset: 0, background: g.stories[0]?.bgColor ?? '#050505' }} />}
            <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: '50%', border: g.allSeen ? '2px solid #fff' : '3px solid var(--fb-blue)' }}>
              <Avatar name={g.author.displayName} src={g.author.avatarUrl ?? undefined} size={36} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, color: '#fff', fontSize: 12, fontWeight: 600, padding: '14px 6px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', textShadow: '0 1px 2px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.author.username}
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCreating(false)}>
          <div className="card" style={{ width: 340, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>New story</h3>
            <div style={{
              height: 200, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: color, color: '#fff', padding: 16, textAlign: 'center', marginBottom: 12, fontSize: 16,
            }}>{text || 'Preview'}</div>
            <textarea className="input" rows={2} placeholder="Story text…" value={text} onChange={(e) => setText(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>Color:</span>
              {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'].map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid var(--text)' : 'none', cursor: 'pointer',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="btn btn-secondary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              </label>
              <button className="btn" style={{ flex: 1 }} disabled={!text.trim()} onClick={createText}>Post text story</button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <StoryViewer group={viewing.group} startIndex={viewing.index}
          me={me} onClose={() => setViewing(null)} onView={view} onDeleted={load} />
      )}
    </>
  );
}

function StoryViewer({ group, startIndex, me, onClose, onView, onDeleted }: {
  group: Group; startIndex: number; me: string | null;
  onClose: () => void; onView: (id: string) => void; onDeleted: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<Array<{ username: string; displayName: string }> | null>(null);
  const story = group.stories[index];

  useEffect(() => {
    if (story) onView(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    setProgress(0);
    const timer = setInterval(() => setProgress((p) => p + 2), 100); // 5s per story
    return () => clearInterval(timer);
  }, [index]);

  useEffect(() => {
    if (progress >= 100) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function next() {
    if (index < group.stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }
  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function showViewers() {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/stories/${story.id}/viewers`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setViewers((await res.json()).viewers);
  }

  async function remove() {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/stories/${story.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { onDeleted(); onClose(); }
  }

  if (!story) return null;
  const isMine = group.author.username === me;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'relative', width: 360, maxWidth: '90vw', height: 560, maxHeight: '85vh', borderRadius: 16, overflow: 'hidden', background: story.bgColor }}
        onClick={(e) => e.stopPropagation()}>
        {/* progress bars */}
        <div style={{ display: 'flex', gap: 4, padding: 10 }}>
          {group.stories.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: i < index ? '100%' : i === index ? `${Math.min(progress, 100)}%` : 0, background: '#fff', borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ padding: '0 12px', color: '#fff', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          {group.author.displayName} <span style={{ opacity: 0.7, fontWeight: 400 }}>@{group.author.username}</span>
        </div>

        <div style={{ position: 'absolute', inset: 0, top: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#fff', textAlign: 'center', fontSize: 22, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          {story.mediaUrl
            ? <img src={story.mediaUrl} alt="story" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
            : story.bgText}
        </div>

        {/* nav zones */}
        <div style={{ position: 'absolute', left: 0, top: 60, bottom: 0, width: '35%', cursor: 'pointer' }} onClick={prev} />
        <div style={{ position: 'absolute', right: 0, top: 60, bottom: 0, width: '35%', cursor: 'pointer' }} onClick={next} />

        {/* footer */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 12, opacity: 0.8, flex: 1 }}>
            {isMine ? 'Your story' : new Date(String(story.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMine && <button className="btn btn-secondary" style={{ padding: '4px 10px', minHeight: 0, fontSize: 12 }} onClick={showViewers}>👁 viewers</button>}
          {isMine && <button className="btn btn-secondary" style={{ padding: '4px 10px', minHeight: 0, fontSize: 12 }} onClick={remove}>Delete</button>}
          <button className="btn btn-secondary" style={{ padding: '4px 10px', minHeight: 0 }} onClick={onClose}>✕</button>
        </div>
        {viewers && (
          <div style={{ position: 'absolute', bottom: 52, left: 12, right: 12, background: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, maxHeight: 160, overflowY: 'auto' }}>
            {viewers.length === 0 && <span style={{ opacity: 0.7 }}>No viewers yet</span>}
            {viewers.map((v) => <div key={v.username}>@{v.username}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
