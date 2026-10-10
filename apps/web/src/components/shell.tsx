'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// Colored SVG icon set (Facebook-style colors). Use via <Icon name="home" size={24} color="#1877F2" />
const ICON_PATHS: Record<string, { path: string; color: string; viewBox?: string }> = {
  home: { path: 'M12 3.1 2.5 11h2.6v8.4c0 .8.7 1.5 1.5 1.5h3.9v-6h3v6h3.9c.8 0 1.5-.7 1.5-1.5V11h2.6L12 3.1z', color: '#1877F2' },
  friends: { path: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 .5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-3.9 0-7 1.9-7 4.2V19h14v-1.8C16 14.9 12.9 13 9 13zm7.5.6c-.6 0-1.2.1-1.8.2 1.4 1 2.3 2.3 2.3 3.7V19H22v-1.4c0-1.9-2.6-3.4-5.5-3.4z', color: '#1877F2' },
  watch: { path: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm6 3.5v7l6-3.5-6-3.5z', color: '#8B5CF6' },
  bell: { path: 'M12 22a2.3 2.3 0 0 0 2.3-2.3H9.7A2.3 2.3 0 0 0 12 22zm7-5.5v-1l-1.5-1.8V9.5c0-3-1.9-5.4-4.5-6V3a1 1 0 1 0-2 0v.5c-2.6.6-4.5 3-4.5 6v4.2L5 15.5v1h14z', color: '#E4405F' },
  chat: { path: 'M12 2.5C6.5 2.5 2 6.4 2 11.2c0 2.7 1.4 5.1 3.7 6.7V22l3.8-2.1c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.7S17.5 2.5 12 2.5z', color: '#0084FF' },
  groups: { path: 'M12 5.5 3 10l9 4.5 9-4.5-9-4.5zM6 13.2v3.1c0 1.5 2.7 3.2 6 3.2s6-1.7 6-3.2v-3.1l-6 3-6-3z', color: '#1877F2' },
  events: { path: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8v10H5V10h14zM7 12v3h3v-3H7z', color: '#F02849' },
  jobs: { path: 'M10 2h4a2 2 0 0 1 2 2v2h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4V4a2 2 0 0 1 2-2zm0 4h4V4h-4v2z', color: '#0A66C2' },
  saved: { path: 'M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1z', color: '#A855F7' },
  analytics: { path: 'M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z', color: '#16A34A' },
  settings: { path: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm9 3.5c0-.7-.1-1.3-.2-2l2.1-1.6-2-3.5-2.5 1a8.9 8.9 0 0 0-1.7-1L16.3 2h-4l-.4 2.9c-.6.2-1.2.6-1.7 1l-2.5-1-2 3.5L7.8 10c-.1.7-.2 1.3-.2 2s.1 1.3.2 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.8 1.7 1l.4 2.9h4l.4-2.9c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.5-2.1-1.6c.1-.7.2-1.3.2-2z', color: '#B0B3B8' },
  search: { path: 'M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z', color: '#B0B3B8' },
  admin: { path: 'M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm0 4.2 5 1.9v3.9c0 3.7-2.1 7.2-5 8.5-2.9-1.3-5-4.8-5-8.5V8.1l5-1.9z', color: '#DC2626' },
  menu: { path: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z', color: '#B0B3B8' },
  thumb: { path: 'M2 10h4v11H2V10zm20 2c0-1.1-.9-2-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 3 6.6 9.6c-.4.4-.6.9-.6 1.4v8c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-1z', color: '#B0B3B8' },
  comment: { path: 'M12 2.5C6.5 2.5 2 6.4 2 11.2c0 2.7 1.4 5.1 3.7 6.7V22l3.8-2.1c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.7S17.5 2.5 12 2.5z', color: '#B0B3B8' },
  photo: { path: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 13h14l-4.5-6-3.5 4.5-2.5-3L5 17zm2.5-6.5A1.5 1.5 0 1 0 7.5 8a1.5 1.5 0 0 0 0 3z', color: '#45BD62' },
  video: { path: 'M4 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm13 4.5 4-2.5v10l-4-2.5v-5z', color: '#F02849' },
  smile: { path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 17.5c-2.3 0-4.3-1.4-5.2-3.5h10.4c-.9 2.1-2.9 3.5-5.2 3.5z', color: '#F7B928' },
  plus: { path: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', color: '#B0B3B8' },
  poll: { path: 'M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z', color: '#1877F2' },
};

export function Icon({ name, size = 24, color, className }: { name: keyof typeof ICON_PATHS | string; size?: number; color?: string; className?: string }) {
  const def = ICON_PATHS[name] ?? ICON_PATHS.home;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={def.path} fill={color || def.color} fillRule="evenodd" />
    </svg>
  );
}

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
      <Link href="/home" className="logo" style={{ fontSize: 28, textDecoration: 'none', flexShrink: 0 }}>Bhasebook</Link>
      <form action="/search" className="topbar-form" style={{ flex: 1, maxWidth: 240, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: 8 }}><Icon name="search" size={16} /></span>
        <input className="topbar-search" name="q" placeholder="Search Bhasebook" aria-label="Search" />
      </form>
      <span style={{ flex: 1 }} />
      <nav className="topbar-nav row" style={{ gap: 4 }}>
        <Link href="/communities" className={`navicon topnav-desk${active === 'groups' ? ' active' : ''}`} title="Create / Groups">
          <Icon name="plus" />
        </Link>
        <Link href="/messages" className={`navicon${active === 'messages' ? ' active' : ''}`} title="Messenger">
          <Icon name="chat" />
          {messages > 0 && <span className="dot blue">{messages > 99 ? '99+' : messages}</span>}
        </Link>
        <Link href="/notifications" className={`navicon${active === 'notifications' ? ' active' : ''}`} title="Notifications">
          <Icon name="bell" />
          {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
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
  { id: 'friends', href: '/friends', icon: 'friends', label: 'Friends' },
  { id: 'groups', href: '/communities', icon: 'groups', label: 'Groups' },
  { id: 'messages', href: '/messages', icon: 'chat', label: 'Messenger' },
  { id: 'watch', href: '/reels', icon: 'watch', label: 'Watch' },
  { id: 'events', href: '/events', icon: 'events', label: 'Events' },
  { id: 'jobs', href: '/jobs', icon: 'jobs', label: 'Jobs' },
  { id: 'saved', href: '/bookmarks', icon: 'saved', label: 'Saved' },
  { id: 'analytics', href: '/analytics', icon: 'analytics', label: 'Analytics' },
  { id: 'settings', href: '/settings', icon: 'settings', label: 'Settings' },
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
          <Icon name={l.icon} size={22} />
          <span>{l.label}</span>
        </Link>
      ))}
      {isAdmin && (
        <Link href="/admin" className={`sidelink${active === 'admin' ? ' active' : ''}`}>
          <Icon name="admin" size={22} /><span>Admin</span>
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
  { id: 'home', href: '/home', icon: 'home', label: 'Home' },
  { id: 'watch', href: '/reels', icon: 'watch', label: 'Reels' },
  { id: 'friends', href: '/friends', icon: 'friends', label: 'Friends' },
  { id: 'groups', href: '/communities', icon: 'groups', label: 'Groups' },
  { id: 'notifications', href: '/notifications', icon: 'bell', label: 'Notifications' },
];

function BottomNav({ active }: { active: string }) {
  const { unread } = useUnread();
  return (
    <nav className="bottomnav">
      {BOTTOM.map((b) => (
        <Link key={b.id} href={b.href} className={active === b.id ? 'active' : ''} aria-label={b.label}>
          <Icon name={b.icon} size={26} />
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
