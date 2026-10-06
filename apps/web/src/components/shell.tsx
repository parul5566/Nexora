'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export function Avatar({ src, name, size = 40, square = false }: { src?: string | null; name: string; size?: number; square?: boolean }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const showImg = src && !broken;
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, borderRadius: square ? size * 0.18 : '50%', fontSize: size * 0.42 }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setBroken(true)}
        />
      ) : initial}
    </div>
  );
}

export function ChipRow({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="chips">
      {tabs.map((t) => (
        <button key={t.id} className={`chip${active === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function FbCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={style}>{children}</div>;
}

export function PillButton({ children, onClick, variant = 'primary', disabled, href, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'white';
  disabled?: boolean; href?: string; style?: React.CSSProperties;
}) {
  const cls = `btn btn-sm${variant === 'secondary' ? ' btn-secondary' : ''}${variant === 'danger' ? ' btn-danger' : ''}${variant === 'white' ? ' btn-white' : ''}`;
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button className={cls} onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function useUnread() {
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState(0);
  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { unread: 0 }))
      .then((d) => setUnread(d.unread ?? 0))
      .catch(() => {});
    fetch(`${API}/api/v1/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d) => setMessages((d.conversations ?? []).reduce((a: number, c: any) => a + (c.unread || 0), 0)))
      .catch(() => {});
  }, []);
  return { unread, messages };
}

function TopBar({ active }: { active: string }) {
  const { unread, messages } = useUnread();
  return (
    <header className="topbar">
      <Link href="/home" className="logo" style={{ fontSize: 28, textDecoration: 'none' }}>Nexora</Link>
      <form action="/search" style={{ flex: 1, maxWidth: 240, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: 8, color: '#65676B' }}>🔍</span>
        <input className="topbar-search" name="q" placeholder="Search Nexora" aria-label="Search" />
      </form>
      <span style={{ flex: 1 }} />
      <nav className="row" style={{ gap: 4 }}>
        <Link href="/home" className={`navicon${active === 'home' ? ' active' : ''}`} title="Home">🏠</Link>
        <Link href="/friends" className={`navicon${active === 'friends' ? ' active' : ''}`} title="Friends">👥</Link>
        <Link href="/reels" className={`navicon${active === 'watch' ? ' active' : ''}`} title="Watch">📺</Link>
        <Link href="/notifications" className={`navicon${active === 'notifications' ? ' active' : ''}`} title="Notifications">
          🔔
          {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
        </Link>
        <Link href="/messages" className={`navicon${active === 'messages' ? ' active' : ''}`} title="Messenger">
          💬
          {messages > 0 && <span className="dot blue">{messages > 99 ? '99+' : messages}</span>}
        </Link>
        <MeAvatar />
      </nav>
    </header>
  );
}

function MeAvatar() {
  const [me, setMe] = useState<{ username: string; displayName: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d.user))
      .catch(() => {});
  }, []);
  return me ? (
    <Link href={`/u/${me.username}`} title={me.displayName}>
      <Avatar src={me.avatarUrl} name={me.displayName} size={36} />
    </Link>
  ) : (
    <span style={{ width: 36 }} />
  );
}

const SIDE_LINKS = [
  { id: 'friends', href: '/friends', icon: '👥', label: 'Friends' },
  { id: 'groups', href: '/communities', icon: '🏷️', label: 'Groups' },
  { id: 'messages', href: '/messages', icon: '💬', label: 'Messenger' },
  { id: 'watch', href: '/reels', icon: '📺', label: 'Watch' },
  { id: 'events', href: '/events', icon: '📅', label: 'Events' },
  { id: 'jobs', href: '/jobs', icon: '💼', label: 'Jobs' },
  { id: 'saved', href: '/bookmarks', icon: '🔖', label: 'Saved' },
  { id: 'analytics', href: '/analytics', icon: '📈', label: 'Analytics' },
  { id: 'settings', href: '/settings', icon: '⚙️', label: 'Settings' },
];

function SideBar({ active }: { active: string }) {
  const [me, setMe] = useState<{ username: string; displayName: string; avatarUrl: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMe(d.user);
        setIsAdmin(!!d.user?.isAdmin);
      })
      .catch(() => {});
  }, []);
  return (
    <aside className="sidebar">
      {me && (
        <Link href={`/u/${me.username}`} className="sidelink" style={{ marginBottom: 8 }}>
          <Avatar src={me.avatarUrl} name={me.displayName} size={36} />
          <span>{me.displayName}</span>
        </Link>
      )}
      {SIDE_LINKS.map((l) => (
        <Link key={l.id} href={l.href} className={`sidelink${active === l.id ? ' active' : ''}`}>
          <span style={{ fontSize: 20 }}>{l.icon}</span>
          <span>{l.label}</span>
        </Link>
      ))}
      {isAdmin && (
        <Link href="/admin" className={`sidelink${active === 'admin' ? ' active' : ''}`}>
          <span style={{ fontSize: 20 }}>🛡️</span><span>Admin</span>
        </Link>
      )}
    </aside>
  );
}

function ContactsRail() {
  const [contacts, setContacts] = useState<Array<{ id: string; other: any; lastMessage: string | null }>>([]);
  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) return;
    fetch(`${API}/api/v1/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d) => setContacts(d.conversations ?? []))
      .catch(() => {});
  }, []);
  return (
    <aside className="rail">
      <p className="rail-title">Contacts</p>
      {contacts.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No conversations yet.</p>}
      {contacts.map((c) => (
        <Link key={c.id} href="/messages" className="sidelink">
          <Avatar src={c.other?.avatarUrl} name={c.other?.displayName ?? '?'} size={36} />
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.other?.displayName ?? 'Unknown'}
          </span>
        </Link>
      ))}
    </aside>
  );
}

const BOTTOM = [
  { id: 'home', href: '/home', icon: '🏠', label: 'Home' },
  { id: 'friends', href: '/friends', icon: '👥', label: 'Friends' },
  { id: 'watch', href: '/reels', icon: '📺', label: 'Watch' },
  { id: 'notifications', href: '/notifications', icon: '🔔', label: 'Notifications' },
  { id: 'settings', href: '/settings', icon: '☰', label: 'Menu' },
];

function BottomNav({ active }: { active: string }) {
  const { unread } = useUnread();
  return (
    <nav className="bottomnav">
      {BOTTOM.map((b) => (
        <Link key={b.id} href={b.href} className={active === b.id ? 'active' : ''} aria-label={b.label}>
          {b.icon}
          {b.id === 'notifications' && unread > 0 && (
            <span className={unread > 0 ? 'dot' : ''}>{unread > 9 ? '9+' : unread}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <>
      <TopBar active={active} />
      <div className="shell">
        <SideBar active={active} />
        <main className="shell-main">{children}</main>
        <ContactsRail />
      </div>
      <BottomNav active={active} />
    </>
  );
}
