'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/shell';

interface AdminUser { id: string; username: string; email: string; status: string; followers: number }
interface ContentItem { id: string; author: string; excerpt: string; deleted: boolean }
interface ReportItem { id: string; reporter: string; objectType: string; objectId: string; reason: string; status: string }
interface AuditItem { id: string; moderator: string; action: string; objectType: string | null; objectId: string | null; targetUser: string | null; createdAt: string }
interface Stats { users: number; posts: number; comments: number; reactions: number; follows: number; messages: number; communities: number; companies: number; jobs: number; events: number; reels: number; stories: number; openReports: number; bannedUsers: number; dau?: number; mau?: number; watchTimeSeconds?: number; shares?: number; saves?: number; connections?: number; retention?: { day1: number; day7: number; day30: number } }

type Tab = 'overview' | 'users' | 'content' | 'reports' | 'audit';

export default function AdminPanel() {
  const [tier, setTier] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentType, setContentType] = useState<'post' | 'reel' | 'comment'>('post');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/v1/admin/me', { credentials: 'include' });
      if (res.status === 403 || res.status === 401) { setDenied(true); return; }
      const data = await res.json();
      setTier(data.tier);
    })();
  }, []);

  const load = useCallback(async (t: Tab) => {
    setMsg(null);
    if (t === 'overview') {
      const res = await fetch('/api/v1/admin/analytics', { credentials: 'include' });
      if (res.ok) setStats(await res.json());
    } else if (t === 'users') {
      const res = await fetch(`/api/v1/admin/users?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (res.ok) setUsers((await res.json()).users);
      else setMsg('Your admin role does not permit user management.');
    } else if (t === 'content') {
      const res = await fetch(`/api/v1/admin/content/${contentType}`, { credentials: 'include' });
      if (res.ok) setContent((await res.json()).items);
      else setMsg('Your admin role does not permit content management.');
    } else if (t === 'reports') {
      const res = await fetch('/api/v1/admin/reports?status=all', { credentials: 'include' });
      if (res.ok) setReports((await res.json()).reports);
    } else if (t === 'audit') {
      const res = await fetch('/api/v1/admin/audit', { credentials: 'include' });
      if (res.ok) setAudit((await res.json()).actions);
    }
  }, [q, contentType]);

  useEffect(() => { if (tier) void load(tab); }, [tab, tier, load]);

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/v1/admin/users/${id}/status`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
    });
    setMsg(res.ok ? `User status set to ${status}.` : 'Failed to update status.');
    void load('users');
  };

  const contentAction = async (id: string, action: string) => {
    const res = await fetch(`/api/v1/admin/content/${contentType}/${id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
    });
    setMsg(res.ok ? `Content ${action} done.` : 'Failed — your role may not permit content management.');
    void load('content');
  };

  if (denied) {
    return (
      <AppShell active="menu">
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Admin Panel</h1>
          <p style={{ color: '#E41E3F' }}>Access denied. This area is restricted to administrators.</p>
        </div>
        </div>
      </AppShell>
    );
  }

  const tabs: Tab[] = ['overview', 'users', 'content', 'reports', 'audit'];

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Admin Panel {tier && <span style={{ fontSize: 13, opacity: 0.6 }}>({tier})</span>}</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button key={t} className={`btn ${t === tab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}

      {tab === 'overview' && stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, margin: '16px 0' }}>
            <div style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.dau ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>dau (active 24h)</div>
            </div>
            <div style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.mau ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>mau (active 30d)</div>
            </div>
            <div style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.retention ? `${stats.retention.day1}% / ${stats.retention.day7}% / ${stats.retention.day30}%` : '—'}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>retention d1 / d7 / d30</div>
            </div>
            <div style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{Math.round((stats.watchTimeSeconds ?? 0) / 60)}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>watch time (minutes)</div>
            </div>
            <div style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.saves ?? 0}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>saves</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, margin: '16px 0' }}>
            {Object.entries(stats)
              .filter(([k]) => !['dau', 'mau', 'retention', 'watchTimeSeconds', 'saves'].includes(k))
              .map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{v as number}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <input className="input" placeholder="Search username or email…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary" onClick={() => load('users')}>Search</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {users.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, flexWrap: 'wrap' }}>
                <strong>@{u.username}</strong>
                <span style={{ opacity: 0.6 }}>{u.email}</span>
                <span style={{ opacity: 0.6 }}>{u.followers} followers</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, color: u.status === 'active' ? 'green' : 'crimson' }}>{u.status}</span>
                {['active', 'restricted', 'suspended', 'banned'].filter((s) => s !== u.status).map((s) => (
                  <button key={s} className="btn btn-secondary" onClick={() => setStatus(u.id, s)}>{s}</button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'content' && (
        <>
          <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
            {(['post', 'reel', 'comment'] as const).map((t) => (
              <button key={t} className={`btn ${t === contentType ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setContentType(t)}>{t}s</button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {content.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: c.deleted ? 'line-through' : 'none' }}>
                  {c.excerpt || '(no text)'}
                </span>
                <span style={{ opacity: 0.6 }}>@{c.author}</span>
                {c.deleted
                  ? <button className="btn btn-secondary" onClick={() => contentAction(c.id, 'restore')}>Restore</button>
                  : <button className="btn btn-secondary" onClick={() => contentAction(c.id, 'remove')}>Remove</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'reports' && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {reports.map((r) => (
            <div key={r.id} style={{ padding: '8px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>#{r.id}</span>
              <span>{r.objectType} {r.objectId}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{r.reason}</span>
              <span style={{ opacity: 0.6 }}>by @{r.reporter}</span>
              <span style={{ fontWeight: 600, color: r.status === 'open' ? 'goldenrod' : r.status === 'resolved' ? 'green' : 'gray' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {audit.map((a) => (
            <div key={a.id} style={{ padding: '6px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <strong>{a.action}</strong>
              <span style={{ opacity: 0.7 }}>by @{a.moderator}</span>
              {a.targetUser && <span>→ @{a.targetUser}</span>}
              {a.objectType && <span style={{ opacity: 0.6 }}>{a.objectType} #{a.objectId}</span>}
              <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 12 }}>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      </div>
      </div>
    </AppShell>
  );
}
