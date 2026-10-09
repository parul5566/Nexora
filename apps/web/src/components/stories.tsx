'use client';

import { useEffect, useState, useCallback } from 'react';
import { Avatar } from './shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Story { id: string; mediaUrl: string | null; mediaType?: 'photo' | 'video' | 'music' | null; bgText: string | null; bgColor: string; createdAt?: string; seen: boolean; author?: any; }
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

  async function publish(file: File, mediaType: 'photo' | 'video' | 'music') {
    setUploading(true);
    try {
      const token = localStorage.getItem('nexora_token')!;
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(`${API}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!up.ok) throw new Error((await up.json().catch(() => null))?.error?.message ?? 'Upload failed');
      const media = (await up.json()).media;
      const res = await fetch(`${API}/api/v1/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl: media.resizedUrl || media.url, mediaType }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? 'Publish failed');
      setCreating(false);
      load();
      onPosted?.();
    } finally {
      setUploading(false);
    }
  }

  async function view(storyId: string) {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/stories/${storyId}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(() => load());
  }

  const self = groups.find((g) => g.isSelf);
  const others = groups.filter((g) => !g.isSelf);
  const [meProfile, setMeProfile] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMeProfile(d.user))
      .catch(() => {});
  }, []);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        <div className="fb-create-story" style={{
          textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12,
          overflow: 'hidden', position: 'relative', background: 'var(--fb-surface)', border: '1px solid var(--fb-border)',
        }} onClick={() => setCreating(true)}>
          <div style={{ height: 130, background: 'var(--fb-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Avatar name={meProfile?.displayName ?? 'You'} src={meProfile?.avatarUrl ?? undefined} size={56} />
            <span style={{
              position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
              width: 26, height: 26, borderRadius: '50%', background: 'var(--fb-blue)', color: '#fff',
              border: '3px solid var(--fb-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 700, lineHeight: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}>+</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 4px' }}>Create story</div>
        </div>
        {self && (
          <div key="self" style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
            onClick={() => setViewing({ group: self, index: 0 })}>
            {(self.stories[0]?.mediaType ?? (self.stories[0]?.mediaUrl ? 'photo' : null)) === 'photo'
              ? // eslint-disable-next-line @next/next/no-img-element
              <img src={self.stories[0].mediaUrl!} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ position: 'absolute', inset: 0, background: self.stories[0]?.bgColor ?? '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff' }}>{self.stories[0]?.mediaType === 'music' ? '♪' : '▶'}</div>}
            <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: '50%', border: self.allSeen ? '2px solid #fff' : '3px solid var(--fb-blue)' }}>
              <Avatar name={self.author.displayName} src={self.author.avatarUrl ?? undefined} size={36} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, color: '#fff', fontSize: 12, fontWeight: 600, padding: '14px 6px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>You</div>
          </div>
        )}
        {others.map((g) => (
          <div key={g.author.username} style={{ textAlign: 'center', flexShrink: 0, cursor: 'pointer', width: 108, height: 180, borderRadius: 12, overflow: 'hidden', position: 'relative' }}
            onClick={() => setViewing({ group: g, index: 0 })}>
            {(g.stories[0]?.mediaType ?? (g.stories[0]?.mediaUrl ? 'photo' : null)) === 'photo'
              ? // eslint-disable-next-line @next/next/no-img-element
              <img src={g.stories[0].mediaUrl!} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ position: 'absolute', inset: 0, background: g.stories[0]?.bgColor ?? '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff' }}>{g.stories[0]?.mediaType === 'music' ? '♪' : '▶'}</div>}
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
        <StoryComposer
          uploading={uploading}
          text={text} setText={setText} color={color} setColor={setColor}
          onPublishText={createText}
          onPublishFile={(f, t) => publish(f, t)}
          onClose={() => setCreating(false)}
        />
      )}

      {viewing && (
        <StoryViewer group={viewing.group} startIndex={viewing.index}
          me={me} onClose={() => setViewing(null)} onView={view} onDeleted={load} />
      )}
    </>
  );
}

const PICKER_OPTIONS = [
  { type: 'photo' as const, label: 'Photo', accept: 'image/jpeg,image/png,image/webp,image/gif', gradient: 'linear-gradient(135deg,#1877F2,#42A5F5)' },
  { type: 'video' as const, label: 'Video', accept: 'video/mp4,video/webm,video/quicktime', gradient: 'linear-gradient(135deg,#8B5CF6,#C084FC)' },
  { type: 'music' as const, label: 'Music', accept: 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm', gradient: 'linear-gradient(135deg,#EC4899,#F97316)' },
];

function StoryComposer({ uploading, text, setText, color, setColor, onPublishText, onPublishFile, onClose }: {
  uploading: boolean;
  text: string; setText: (v: string) => void;
  color: string; setColor: (v: string) => void;
  onPublishText: () => void;
  onPublishFile: (file: File, type: 'photo' | 'video' | 'music') => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<{ type: 'photo' | 'video' | 'music'; file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(opt: (typeof PICKER_OPTIONS)[number]) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = opt.accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      setError(null);
      setPicked({ type: opt.type, file: f, url: URL.createObjectURL(f) });
    };
    input.click();
  }

  // Cleanup object URL on unmount
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onClick={() => { if (!uploading) onClose(); }}>
      {!picked ? (
        /* ---- Type picker ---- */
        <div className="card" style={{ width: 360, maxWidth: '94vw', padding: 20 }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 4px' }}>Create story</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.7 }}>Choose what you want to share — visible for 24 hours.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PICKER_OPTIONS.map((opt) => (
              <button key={opt.type} disabled={uploading}
                onClick={() => choose(opt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
                  background: 'var(--fb-surface, #fff)', border: '1px solid var(--fb-border, #E4E6EB)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ width: 44, height: 44, borderRadius: 10, background: opt.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {opt.type === 'photo' && <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>}
                    {opt.type === 'video' && <><rect x="2" y="4" width="15" height="16" rx="2" /><path d="M22 8l-5 4 5 4V8z" /></>}
                    {opt.type === 'music' && <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>}
                  </svg>
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--text, #050505)' }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.65, color: 'var(--text, #050505)' }}>
                    {opt.type === 'photo' ? 'JPG, PNG, WebP or GIF' : opt.type === 'video' ? 'MP4, WebM or MOV' : 'MP3, M4A, OGG or WAV'}
                  </span>
                </span>
                <span style={{ color: 'var(--fb-blue, #1877F2)', fontWeight: 700 }}>+</span>
              </button>
            ))}
            {/* Text story kept as a fourth lightweight option */}
            <button disabled={uploading} onClick={() => { setError(null); setText(text); }}
              style={{ display: 'none' }} />
          </div>
          {uploading && <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--fb-blue, #1877F2)', fontWeight: 600 }}>Uploading…</p>}
          <button className="btn btn-secondary" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Cancel</button>
        </div>
      ) : (
        /* ---- 9:16 preview ---- */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            width: 'min(360px, 92vw)', aspectRatio: '9 / 16', maxHeight: '78vh', borderRadius: 16, overflow: 'hidden',
            background: picked.type === 'music' ? 'linear-gradient(160deg,#1c2b4a,#0b1220)' : '#000',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            {picked.type === 'photo' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {picked.type === 'video' && (
              <video src={picked.url} controls autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {picked.type === 'music' && (
              <div style={{ textAlign: 'center', color: '#fff', padding: 24 }}>
                <div style={{ width: 84, height: 84, margin: '0 auto 18px', borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>♪</div>
                <div style={{ fontWeight: 600, marginBottom: 14, wordBreak: 'break-all', fontSize: 14 }}>{picked.file.name}</div>
                <audio src={picked.url} controls style={{ width: '100%' }} />
              </div>
            )}
            <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>
              {picked.type === 'photo' ? 'Photo' : picked.type === 'video' ? 'Video' : 'Music'} · 24h
            </span>
          </div>
          {error && <p style={{ margin: 0, color: '#fff', background: '#C9302C', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, width: 'min(360px, 92vw)' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} disabled={uploading}
              onClick={() => { URL.revokeObjectURL(picked.url); setPicked(null); }}>Back</button>
            <button className="btn" style={{ flex: 1.4 }} disabled={uploading}
              onClick={async () => { try { onPublishFile(picked.file, picked.type); } catch (e: any) { setError(e?.message ?? 'Publish failed'); } }}>
              {uploading ? 'Publishing…' : 'Publish story'}
            </button>
          </div>
        </div>
      )}
    </div>
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
          {story.mediaUrl && (story.mediaType ?? 'photo') === 'photo'
            ? <img src={story.mediaUrl} alt="story" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
            : story.mediaUrl && (story.mediaType ?? 'photo') === 'video'
            ? <video src={story.mediaUrl} autoPlay muted loop playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
            : story.mediaUrl && story.mediaType === 'music'
            ? <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>♪</div>
                <audio src={story.mediaUrl} autoPlay controls style={{ width: '100%' }} />
              </div>
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
