'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell, Icon, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const SECTIONS: Array<{ title: string; items: Array<{ label: string; href: string; icon: string; desc: string }> }> = [
  {
    title: 'Account',
    items: [
      { label: 'Edit profile', href: '/settings/profile', icon: 'friends', desc: 'Photo, bio, headline, privacy' },
      { label: 'Your profile', href: '/home', icon: 'home', desc: 'See your public profile' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { label: 'Saved posts', href: '/bookmarks', icon: 'saved', desc: 'Posts you bookmarked' },
      { label: 'Notifications', href: '/notifications', icon: 'bell', desc: 'Likes, comments, mentions' },
      { label: 'Chats', href: '/messages', icon: 'chat', desc: 'Your conversations' },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Groups', href: '/communities', icon: 'groups', desc: 'Communities you joined' },
      { label: 'Events', href: '/events', icon: 'events', desc: 'Upcoming events' },
      { label: 'Jobs', href: '/jobs', icon: 'jobs', desc: 'Job listings and applications' },
      { label: 'Watch', href: '/reels', icon: 'watch', desc: 'Short videos' },
    ],
  },
];

export default function SettingsPage() {
  const [me, setMe] = useState<{ username: string; displayName: string; avatarUrl: string | null } | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user))
      .catch(() => {});
  }, []);

  async function logout() {
    const token = localStorage.getItem('nexora_token');
    if (token) {
      await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem('nexora_token');
    setLoggedOut(true);
    setTimeout(() => { window.location.href = '/login'; }, 400);
  }

  const body = (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: 22 }}>Settings & privacy</h1>
      {me && (
        <Link href={`/u/${me.username}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 16, textDecoration: 'none', color: 'var(--fb-text)' }}>
          <Avatar name={me.displayName} src={me.avatarUrl ?? undefined} size={52} />
          <div>
            <div style={{ fontWeight: 600 }}>{me.displayName}</div>
            <div className="muted" style={{ fontSize: 13 }}>See your profile</div>
          </div>
        </Link>
      )}
      {SECTIONS.map((s) => (
        <div key={s.title} style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, color: 'var(--fb-text-secondary)', margin: '0 0 6px 4px' }}>{s.title}</h2>
          {s.items.map((it) => (
            <Link key={it.label} href={it.href} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 6, textDecoration: 'none', color: 'var(--fb-text)' }}>
              <Icon name={it.icon} size={24} />
              <div>
                <div style={{ fontWeight: 600 }}>{it.label}</div>
                <div className="muted" style={{ fontSize: 13 }}>{it.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--fb-text-secondary)' }}>›</span>
            </Link>
          ))}
        </div>
      ))}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 40 }}>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout} disabled={loggedOut}>
          {loggedOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  );

  return <AppShell active="menu">{body}</AppShell>;
}
