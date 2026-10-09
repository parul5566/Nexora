'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, Icon } from './shell';

// Colored SVG glyph paths for post/composer icons (rendered via shell Icon)
const EXTRA_ICONS: Record<string, string> = {};

const API = process.env.NEXT_PUBLIC_API_URL || '';

export interface PostView {
  id: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  type: string;
  content: string | null;
  linkUrl: string | null;
  visibility: string;
  media: Array<{ url: string; kind: string }>;
  poll?: { question: string | null; options: Array<{ id: string; label: string; votes: number; percent: number }>; totalVotes: number; userVotedOptionId: string | null };
  hashtags: string[];
  mentions: string[];
  isDraft: boolean;
  edited: boolean;
  bookmarked?: boolean;
  reactions?: { counts: Record<string, number>; total: number; myReaction: string | null; topTypes: string[] };
  commentCount?: number;
  createdAt: string;
}

/** Render content with #hashtags and @mentions linked. */
export function PostContent({ content }: { content: string | null }) {
  if (!content) return null;
  const parts = content.split(/(#[\p{L}\p{N}_]+|@[a-z0-9_]+)/giu);
  return (
    <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
      {parts.map((p, i) => {
        if (/^#/.test(p)) return <Link key={i} href={`/hashtag/${p.slice(1).toLowerCase()}`}>{p}</Link>;
        if (/^@/.test(p)) return <Link key={i} href={`/u/${p.slice(1).toLowerCase()}`}>{p}</Link>;
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export function PostCard({ post, onChanged, children }: { post: PostView; onChanged?: () => void; children?: React.ReactNode }) {
  const [state, setState] = useState(post);
  const [voting, setVoting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;

  const REACTIONS = [
    ['like', '👍'], ['love', '❤️'], ['haha', '😂'], ['wow', '😮'], ['sad', '😢'], ['angry', '😡'],
  ] as const;

  async function react(type: string) {
    if (!token) return;
    const next = state.reactions?.myReaction === type ? 'none' : type;
    const res = await fetch(`${API}/api/v1/posts/${state.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: next }),
    });
    if (res.ok) {
      const { reactions } = await res.json();
      setState((s) => ({ ...s, reactions }));
      onChanged?.();
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    const res = await fetch(`${API}/api/v1/posts/${state.id}/comments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) setComments((await res.json()).comments);
    setLoadingComments(false);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  }

  async function submitComment(parentId: string | null, content: string, reset?: () => void) {
    if (!token || !content.trim()) return;
    const res = await fetch(`${API}/api/v1/posts/${state.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, parentId }),
    });
    if (res.ok) {
      reset?.();
      setCommentText('');
      loadComments();
      setState((s) => ({ ...s, commentCount: (s.commentCount ?? 0) + 1 }));
      onChanged?.();
    }
  }

  function CommentForm({ parentId, onDone }: { parentId: string | null; onDone?: () => void }) {
    const [text, setText] = useState('');
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <input
          className="input"
          style={{ borderRadius: 999 }}
          placeholder={parentId ? 'Reply…' : 'Write a comment…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) submitComment(parentId, text, () => { setText(''); onDone?.(); }); }}
        />
        <button
          className="btn btn-primary btn-pill"
          style={{ padding: '6px 16px', minHeight: 0 }}
          disabled={!text.trim()}
          onClick={() => submitComment(parentId, text, () => { setText(''); onDone?.(); })}
        >Send</button>
      </div>
    );
  }

  function CommentItem({ c, depth }: { c: any; depth: number }) {
    const [replying, setReplying] = useState(false);
    const [rx, setRx] = useState(c.reactions);
    if (depth === 0) return null;
    return (
      <div style={{ marginLeft: depth > 1 ? 24 : 0, marginTop: 10, display: 'flex', gap: 8 }}>
        <Link href={`/u/${c.author.username}`}><Avatar name={c.author.displayName} src={c.author.avatarUrl ?? undefined} size={32} /></Link>
        <div style={{ flex: 1 }}>
          <div style={{ background: 'var(--fb-canvas)', borderRadius: 16, padding: '8px 12px', display: 'inline-block' }}>
            <Link href={`/u/${c.author.username}`} style={{ fontWeight: 600, fontSize: 13 }}>{c.author.displayName}</Link>
            <p style={{ marginTop: 2, fontSize: 14 }}>{c.content}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 3, paddingLeft: 12, fontSize: 12 }}>
            {token && (
              <button
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, color: rx.myReaction === 'like' ? 'var(--fb-blue)' : 'var(--fb-text-secondary)' }}
                onClick={async () => {
                  const next = rx.myReaction === 'like' ? 'none' : 'like';
                  const res = await fetch(`${API}/api/v1/comments/${c.id}/reactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ type: next }),
                  });
                  if (res.ok) setRx((await res.json()).reactions);
                }}
              >Like{rx.total ? ` · ${rx.total}` : ''}</button>
            )}
            {token && <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--fb-text-secondary)' }} onClick={() => setReplying((r) => !r)}>Reply</button>}
            <span className="muted">{c.edited ? '(edited) ' : ''}{new Date(c.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  }

  async function vote(optionId: string) {
    if (!token || voting || state.poll?.userVotedOptionId) return;
    setVoting(true);
    const res = await fetch(`${API}/api/v1/posts/${state.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ optionId: Number(optionId) }),
    });
    if (res.ok) setState((await res.json()).post);
    setVoting(false);
    onChanged?.();
  }

  async function toggleBookmark() {
    if (!token) return;
    const method = state.bookmarked ? 'DELETE' : 'POST';
    const res = await fetch(`${API}/api/v1/posts/${state.id}/bookmark`, { method, headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { setState((s) => ({ ...s, bookmarked: !s.bookmarked })); onChanged?.(); }
  }

  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={`/u/${state.author.username}`}><Avatar name={state.author.displayName} src={state.author.avatarUrl ?? undefined} size={40} /></Link>
          <div style={{ lineHeight: 1.25 }}>
            <Link href={`/u/${state.author.username}`} style={{ fontWeight: 600, color: 'var(--fb-text)' }}>
              {state.author.displayName}
            </Link>
            <div className="muted" style={{ fontSize: 12 }}>
              @{state.author.username} · {new Date(state.createdAt).toLocaleDateString()}
              {state.visibility !== 'public' && <span title={state.visibility}> 🔒</span>}
              {state.edited ? ' · edited' : ''}
              {state.isDraft ? ' · draft' : ''}
            </div>
          </div>
        </div>
      </header>
      <PostContent content={state.content} />
      {state.edited && <span className="muted" style={{ fontSize: 12 }}>(edited)</span>}
      {state.linkUrl && (
        <p style={{ marginTop: 8 }}><a href={state.linkUrl} target="_blank" rel="noopener noreferrer">{state.linkUrl}</a></p>
      )}
      {state.media.map((m) =>
        m.kind === 'video' ? (
          <video key={m.url} src={m.url} controls style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 480 }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.url} src={m.url} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 480, objectFit: 'cover' }} />
        ),
      )}
      {state.poll && (
        <div style={{ marginTop: 12 }}>
          {state.poll.question && <p style={{ fontWeight: 600 }}>{state.poll.question}</p>}
          {state.poll.options.map((o) => {
            const voted = state.poll!.userVotedOptionId === o.id;
            const canVote = !!token && !state.poll!.userVotedOptionId;
            return (
              <button
                key={o.id}
                onClick={() => vote(o.id)}
                disabled={!canVote || voting}
                className="btn btn-secondary"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, position: 'relative', overflow: 'hidden', opacity: canVote ? 1 : 0.85 }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {voted ? '● ' : '○ '}{o.label} — {o.percent}% ({o.votes})
                </span>
              </button>
            );
          })}
          <p className="muted" style={{ fontSize: 12 }}>{state.poll.totalVotes} votes</p>
        </div>
      )}
      <footer style={{ marginTop: 8, borderTop: '1px solid var(--fb-border)', paddingTop: 4, display: 'flex', gap: 4 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {token && (
            <div className="reaction-picker" aria-label="Reactions">
              {REACTIONS.map(([type, emoji]) => (
                <button
                  key={type}
                  title={type}
                  onClick={() => react(type)}
                  style={{
                    border: 'none', background: state.reactions?.myReaction === type ? 'var(--fb-tint)' : 'transparent',
                    borderRadius: 999, cursor: 'pointer', fontSize: 20, padding: '4px 5px',
                  }}
                >{emoji}</button>
              ))}
            </div>
          )}
          <button
            className="post-action"
            style={state.reactions?.myReaction ? { color: 'var(--fb-blue)' } : undefined}
            onClick={() => react(state.reactions?.myReaction ?? 'like')}
          >
            <Icon name="thumb" size={18} color={state.reactions?.myReaction ? '#1877F2' : '#65676B'} />
            {state.reactions?.myReaction ? state.reactions.myReaction.charAt(0).toUpperCase() + state.reactions.myReaction.slice(1) : 'Like'}
          </button>
        </div>
        <button className="post-action" style={{ flex: 1, justifyContent: 'center' }} onClick={toggleComments}>
          <Icon name="comment" size={18} color="#65676B" /> Comment
        </button>
        <button className="post-action" style={{ flex: 1, justifyContent: 'center' }} onClick={toggleBookmark}>
          <Icon name="saved" size={18} color={state.bookmarked ? '#A855F7' : '#65676B'} /> {state.bookmarked ? 'Saved' : 'Save'}
        </button>
      </footer>
      {(state.reactions?.total ?? 0) > 0 || (state.commentCount ?? 0) > 0 ? (
        <div style={{ display: 'flex', gap: 10, padding: '6px 2px 0' }}>
          {state.reactions && state.reactions.total > 0 && (
            <span className="muted" style={{ fontSize: 13 }}>
              {state.reactions.topTypes?.slice(0, 3).map((t) => REACTIONS.find(([tt]) => tt === t)?.[1]).join('')} {state.reactions.total}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {(state.commentCount ?? 0) > 0 && (
            <button className="muted" style={{ fontSize: 13, border: 'none', background: 'none', cursor: 'pointer' }} onClick={toggleComments}>
              {state.commentCount} comments
            </button>
          )}
        </div>
      ) : null}
      {state.hashtags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {state.hashtags.map((t) => <Link key={t} className="fb-chip" href={`/hashtag/${t}`}>#{t}</Link>)}
        </div>
      )}
      {showComments && (
        <div style={{ marginTop: 12 }}>
          {loadingComments ? <p className="muted">Loading comments…</p> : (
            <>
              {comments.map((c) => <CommentItem key={c.id} c={c} depth={1} />)}
              {comments.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No comments yet.</p>}
            </>
          )}
          {token && <CommentForm parentId={null} />}
        </div>
      )}
{children}
    </article>
  );
}

export function Composer({ onPosted, communityId }: { onPosted: () => void; communityId?: number }) {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Array<{ url: string; kind: 'image' | 'video' }>>([]);
  const [uploading, setUploading] = useState(0);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [me, setMe] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user))
      .catch(() => {});
  }, []);

  async function uploadFiles(files: FileList) {
    const token = localStorage.getItem('nexora_token');
    for (const file of Array.from(files)) {
      setUploading((u) => u + 1);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      setUploading((u) => u - 1);
      if (res.ok) {
        const data = await res.json();
        const url = data.media.resizedUrl || data.media.url;
        setMediaUrls((m) => [...m, { url, kind: data.media.kind as 'image' | 'video' }]);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err?.error?.message ?? 'Upload failed');
      }
    }
  }

  async function submit(draft: boolean) {
    setError(''); setBusy(true);
    const token = localStorage.getItem('nexora_token');
    const body: any = { content, visibility, draft };
    if (mediaUrls.length) body.mediaUrls = mediaUrls;
    if (pollMode) body.poll = { options: pollOptions.filter((o) => o.trim()) };
    if (communityId) body.communityId = communityId;
    const res = await fetch(`${API}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data?.error?.message ?? 'Post failed'); return; }
    setContent(''); setMediaUrls([]); setPollMode(false); setPollOptions(['', '']);
    onPosted();
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: '14px 16px 10px', borderRadius: 14 }}>
      {/* FB-style header row: avatar + name + visibility pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar name={me?.displayName ?? 'You'} src={me?.avatarUrl ?? undefined} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
            {me?.displayName ?? 'You'}
            {communityId && <span className="muted" style={{ fontWeight: 400 }}> ▸ posting to group</span>}
          </div>
          <select
            aria-label="Post visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            style={{
              border: 'none', background: 'var(--fb-canvas)', color: 'var(--fb-text-secondary)',
              fontSize: 12, padding: '1px 6px', borderRadius: 6, marginTop: 2, cursor: 'pointer', maxWidth: 160,
            }}
          >
            <option value="public">🌐 Public</option>
            <option value="followers">👥 Followers</option>
            <option value="private">🔒 Only me</option>
          </select>
        </div>
      </div>
      {/* Input area */}
      <textarea
        className="fb-composer-input"
        rows={content.length > 120 ? 5 : content.length > 60 ? 3 : 2}
        placeholder={`What's on your mind, ${me?.displayName?.split(' ')[0] ?? 'there'}?`}
        value={content}
        maxLength={5000}
        onChange={(e) => setContent(e.target.value)}
        style={{ resize: 'none', fontSize: 17, border: 'none', padding: '4px 2px', minHeight: 56 }}
      />
      {/* char counter when long */}
      {content.length > 4400 && (
        <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{5000 - content.length} characters left</div>
      )}
      {mediaUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {mediaUrls.map((m) =>
            m.kind === 'video' ? (
              <video key={m.url} src={m.url} controls style={{ height: 60, borderRadius: 8 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.url} src={m.url} alt="" style={{ height: 60, borderRadius: 8 }} />
            ),
          )}
        </div>
      )}
      {pollMode && (
        <div style={{ marginTop: 8 }}>
          {pollOptions.map((o, i) => (
            <input
              key={i}
              className="input"
              placeholder={`Option ${i + 1}`}
              value={o}
              onChange={(e) => setPollOptions((opts) => opts.map((x, j) => (j === i ? e.target.value : x)))}
              style={{ marginBottom: 6 }}
            />
          ))}
          {pollOptions.length < 8 && (
            <button className="btn btn-secondary" style={{ padding: '4px 12px', minHeight: 0 }} onClick={() => setPollOptions((o) => [...o, ''])}>+ Add option</button>
          )}
        </div>
      )}
      {/* FB-style action bar: equal-width tinted action tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
        gap: 6, borderTop: '1px solid var(--fb-border)', marginTop: 10, paddingTop: 8,
      }}>
        <label className="composer-action" style={{ color: '#45BD62', justifyContent: 'center', background: 'var(--fb-canvas)', borderRadius: 8, padding: '8px 6px', cursor: 'pointer' }}>
          <Icon name="photo" size={20} color="#45BD62" /> Photo/Video
          <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </label>
        <button className="composer-action" style={{ color: '#1877F2', justifyContent: 'center', background: pollMode ? 'var(--fb-surface-2)' : 'var(--fb-canvas)', borderRadius: 8, padding: '8px 6px' }} onClick={() => setPollMode((p) => !p)}>
          <Icon name="poll" size={18} color="#1877F2" /> Poll
        </button>
        <button className="composer-action" style={{ color: '#F7B928', justifyContent: 'center', background: 'var(--fb-canvas)', borderRadius: 8, padding: '8px 6px' }} onClick={() => setContent((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}😊`)}>
          <Icon name="smile" size={20} color="#F7B928" /> Feeling
        </button>
        {/* poll icon (svg) defined in ICON_PATHS as 'poll' */}
      </div>
      {/* Footer: upload state + draft/post */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        {uploading > 0 && <span className="muted" style={{ fontSize: 13 }}>Uploading… ({uploading})</span>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-secondary" style={{ padding: '6px 14px', minHeight: 0 }} disabled={busy || !content.trim()} onClick={() => submit(true)}>Save draft</button>
        <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 24px', fontWeight: 800 }} disabled={busy || (!content.trim() && !(pollMode && pollOptions.some((o) => o.trim())))} onClick={() => submit(false)}>
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
