'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const LABELS: Record<string, string> = {
  reaction: 'reacted to your post',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  follow: 'started following you',
  connection_request: 'sent you a connection request',
  connection_accept: 'accepted your connection request',
  mention: 'mentioned you in a post',
};

const ICONS: Record<string, string> = {
  reaction: '👍', comment: '💬', reply: '↩️', follow: '➕',
  connection_request: '🤝', connection_accept: '✅', mention: '@',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'mentions', label: 'Mentions' },
] as const;

export default function NotificationsPage() {
  const [tab, setTab] = useState<string>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async (t: string, cursor: string | null = null) => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    const qs = new URLSearchParams({ limit: '20' });
    if (t !== 'all') qs.set('type', t);
    if (cursor) qs.set('cursor', cursor);
    const res = await fetch(`${API}/api/v1/notifications?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setNotifications((prev) => (cursor ? [...prev, ...data.notifications] : data.notifications));
      setNextCursor(data.nextCursor);
      setUnread(data.unread);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user.username))
      .catch(() => {});
  }, []);

  useEffect(() => { setLoading(true); load(tab); }, [tab, load]);

  async function markAll() {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
      setUnread(0);
    }
  }

  async function markOne(id: string) {
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.ok) {
      setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
  }

  const body = (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Notifications {unread > 0 && <span className="badge">{unread} new</span>}</h1>
        {unread > 0 && <button className="btn btn-secondary" style={{ padding: '6px 14px', minHeight: 0 }} onClick={markAll}>Mark all read</button>}
      </div>
      <div className="chip-row" role="tablist" aria-label="Notification filters" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className="chip"
            style={tab === t.key ? { background: 'var(--fb-tint)', color: 'var(--fb-blue)' } : undefined}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>
      {loading && <p className="muted">Loading…</p>}
      {!loading && notifications.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">No notifications here yet.</p>
        </div>
      )}
      {notifications.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{
            display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, padding: '12px 16px',
            background: n.read ? 'var(--fb-surface)' : 'var(--fb-tint)',
          }}
        >
          {n.actor ? (
            <Link href={`/u/${n.actor.username}`} style={{ position: 'relative' }}>
              <Avatar name={n.actor.displayName} src={n.actor.avatarUrl ?? undefined} size={48} />
              <span style={{
                position: 'absolute', bottom: -3, right: -3, fontSize: 13,
                background: '#fff', borderRadius: '50%', width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{ICONS[n.type] ?? '🔔'}</span>
            </Link>
          ) : (
            <span style={{ fontSize: 20 }}>{ICONS[n.type] ?? '🔔'}</span>
          )}
          <div style={{ flex: 1 }}>
            {n.actor && <Link href={`/u/${n.actor.username}`} style={{ fontWeight: 600 }}>{n.actor.displayName}</Link>}{' '}
            <span>{LABELS[n.type] ?? n.type}</span>
            {n.payload?.postId && (
              <> · <Link href={`/home?post=${n.payload.postId}`} style={{ fontSize: 13 }}>view post</Link></>
            )}
            <div className="muted" style={{ fontSize: 12 }}>{new Date(n.createdAt).toLocaleString()}</div>
          </div>
          {!n.read && (
            <button className="btn btn-secondary" style={{ padding: '4px 10px', minHeight: 0, fontSize: 12 }} onClick={() => markOne(n.id)}>Mark read</button>
          )}
        </div>
      ))}
      {nextCursor && !loading && (
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <button className="btn btn-secondary" onClick={() => load(tab, nextCursor)}>Load more</button>
        </div>
      )}
    </div>
  );

  return <AppShell active="notifications">{body}</AppShell>;
}
