'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Composer, PostCard, type PostView } from '../../../components/posts';
import { AppShell, Avatar, Icon } from '../../../components/shell';

export interface CommunityDetail {
  id: number; name: string; slug: string; description: string | null;
  privacy: 'public' | 'private'; memberCount: number; myRole: string | null; rules: string[] | null;
}

interface Member { username: string; displayName: string; role: string }

const isMod = (role: string | null) => role === 'owner' || role === 'admin' || role === 'moderator';

export default function CommunityPage({ slug }: { slug: string }) {
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'discussion' | 'members' | 'about'>('discussion');

  const authHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = useCallback(async () => {
    try {
      const cRes = await fetch(`/api/v1/communities/${slug}`, { headers: authHeaders() });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData?.error?.message || 'Not found');
      setCommunity(cData.community);
      if (cData.community.privacy === 'private' && !cData.community.myRole) {
        setError('This community is private');
        return;
      }
      const [pRes, mRes] = await Promise.all([
        fetch(`/api/v1/communities/${slug}/posts`, { headers: authHeaders() }),
        fetch(`/api/v1/communities/${slug}/members`, { headers: authHeaders() }),
      ]);
      if (pRes.ok) setPosts((await pRes.json()).posts);
      if (mRes.ok) setMembers((await mRes.json()).members);
    } catch (e: any) { setError(e.message); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function join() { await fetch(`/api/v1/communities/${slug}/join`, { method: 'POST', headers: authHeaders() }); load(); }
  async function leave() { await fetch(`/api/v1/communities/${slug}/leave`, { method: 'POST', headers: authHeaders() }); load(); }
  async function pin(postId: string, pinned: boolean) {
    const res = await fetch(`/api/v1/communities/${slug}/posts/${postId}/pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ pinned }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message || 'Pin failed'); return; }
    setNotice(pinned ? 'Post pinned' : 'Post unpinned');
    load();
  }
  async function moderate(postId: string) {
    await fetch(`/api/v1/communities/${slug}/posts/${postId}/moderate`, { method: 'POST', headers: authHeaders() });
    setNotice('Post removed by moderator');
    load();
  }
  async function setRole(username: string, role: string) {
    const res = await fetch(`/api/v1/communities/${slug}/members/${username}/role`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ role }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message || 'Role change failed'); return; }
    setNotice(`@${username} is now ${role}`);
    load();
  }

  const shell = (children: React.ReactNode) => (
    <AppShell active="groups">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>{children}</div>
    </AppShell>
  );

  if (error && !community) return shell(<p className="error-text">{error}</p>);
  if (!community) return shell(<p className="muted">Loading…</p>);

  const mod = isMod(community.myRole);

  return shell(
    <>
      {/* Facebook-style group cover */}
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden', padding: 0 }}>
        <div style={{
          height: 180,
          background: 'linear-gradient(120deg, var(--fb-blue), #7c3aed 90%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 20, background: 'rgba(255,255,255,.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
            border: '2px solid rgba(255,255,255,.35)', color: '#fff',
          }}>👥</div>
        </div>
        <div style={{ padding: '14px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26 }}>
                {community.name}{' '}
                <Icon name="groups" size={18} className="" />
                {community.privacy === 'private' && <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px', marginLeft: 8 }}>Private group</span>}
              </h1>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                <Icon name="groups" size={14} /> {community.memberCount} members
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!community.myRole && <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 22px' }} onClick={join}>+ Join group</button>}
              {community.myRole && community.myRole !== 'owner' && <button className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px' }} onClick={leave}>Joined ✓ · Leave</button>}
              {community.myRole && <span className="fb-chip" style={{ padding: '6px 12px' }}>{community.myRole === 'owner' ? '👑 Owner' : community.myRole === 'admin' ? '⚙ Admin' : 'Member'}</span>}
            </div>
          </div>
          {/* FB-style tab bar */}
          <div className="chip-row" style={{ borderTop: '1px solid var(--fb-border)', marginTop: 14, padding: '4px 0 0', gap: 4 }}>
            {([['discussion', '💬 Discussion'], ['members', '👥 Members'], ['about', 'ⓘ About']] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className="chip"
                style={{
                  borderRadius: 0, background: 'transparent', border: 'none',
                  borderBottom: tab === key ? '3px solid var(--fb-blue)' : '3px solid transparent',
                  color: tab === key ? 'var(--fb-blue)' : 'var(--fb-text-secondary)', fontWeight: 600,
                }}
                onClick={() => setTab(key)}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'discussion' && (
        <>
          {community.myRole ? <Composer onPosted={() => load()} communityId={community.id} /> : (
            <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 12 }}>
              <p className="muted" style={{ margin: 0 }}>Join this group to post and see the discussion.</p>
            </div>
          )}
          {notice && <p className="fb-chip" style={{ marginBottom: 10 }}>{notice}</p>}
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChanged={load}>
              {mod && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 12px' }} onClick={() => pin(p.id, true)}>Pin</button>
                  <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 12px' }} onClick={() => pin(p.id, false)}>Unpin</button>
                  <button className="btn btn-danger" style={{ minHeight: 0, padding: '6px 12px' }} onClick={() => moderate(p.id)}>Remove</button>
                </div>
              )}
            </PostCard>
          ))}
          {posts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No posts yet.</p></div>}
        </>
      )}

      {tab === 'members' && (community.privacy === 'public' || community.myRole) && (
        <div className="card" style={{ padding: '14px 20px' }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Members · {community.memberCount}</h2>
          {members.map((m) => (
            <div key={m.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', gap: 8, borderBottom: '1px solid var(--fb-border)' }}>
              <a href={`/u/${m.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fb-text)', fontWeight: 500, textDecoration: 'none' }}>
                <Avatar name={m.displayName} size={40} />
                <span>{m.displayName}</span>
              </a>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px' }}>{m.role === 'owner' ? '👑 Owner' : m.role === 'admin' ? '⚙ Admin' : m.role === 'moderator' ? '🛡 Mod' : 'Member'}</span>
                {community.myRole === 'owner' && m.role !== 'owner' && (
                  <>
                    <button className="btn btn-secondary" style={{ minHeight: 0, padding: '4px 10px', fontSize: 12 }} onClick={() => setRole(m.username, 'admin')}>Make admin</button>
                    <button className="btn btn-secondary" style={{ minHeight: 0, padding: '4px 10px', fontSize: 12 }} onClick={() => setRole(m.username, 'moderator')}>Make mod</button>
                  </>
                )}
              </span>
            </div>
          ))}
          {members.length === 0 && <p className="muted">No members to show.</p>}
        </div>
      )}

      {tab === 'about' && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About this group</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{community.description || 'No description yet.'}</p>
          {community.privacy === 'private' && <p className="fb-chip">🔒 Private — only members can see posts</p>}
          {Array.isArray(community.rules) && community.rules.length > 0 && (
            <>
              <h3 style={{ marginBottom: 6 }}>Group rules</h3>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>{community.rules.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}</ol>
            </>
          )}
        </div>
      )}
    </>
  );
}
