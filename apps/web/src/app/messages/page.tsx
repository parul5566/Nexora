'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Conversation { id: string; other: { username: string; displayName: string; avatarUrl: string | null }; lastMessage: string | null; unread: number; }
interface Message { id: string; sender: { username: string }; content: string; createdAt: string; }

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [newUser, setNewUser] = useState('');
  const [error, setError] = useState('');
  const [showList, setShowList] = useState(true); // mobile: list vs thread
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    const res = await fetch(`${API}/api/v1/conversations`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setConversations((await res.json()).conversations);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMe(d.user.username));
    loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (id: string) => {
    const token = localStorage.getItem('nexora_token')!;
    setActiveId(id);
    setShowList(false);
    wsRef.current?.close();
    const res = await fetch(`${API}/api/v1/conversations/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMessages((await res.json()).messages);
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${new URL(API || window.location.origin).host}/ws?token=${token}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', conversationId: Number(id) }));
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data);
          if (frame.type === 'message' && String(frame.message.conversationId) === id) {
            setMessages((ms) => (ms.some((m) => m.id === frame.message.id) ? ms : [...ms, frame.message]));
          }
        } catch { /* ignore */ }
      };
    } catch { /* polling fallback via loadConversations */ }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!activeId || !text.trim()) return;
    const token = localStorage.getItem('nexora_token')!;
    const content = text;
    setText('');
    const res = await fetch(`${API}/api/v1/conversations/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const { message } = await res.json();
      setMessages((ms) => (ms.some((m) => m.id === message.id) ? ms : [...ms, message]));
      loadConversations();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message ?? 'Send failed');
    }
  }

  async function startNew() {
    const username = newUser.trim().replace(/^@/, '');
    if (!username) return;
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Could not start conversation'); return; }
    setError('');
    setNewUser('');
    await loadConversations();
    openConversation(data.id);
  }

  const active = conversations.find((c) => c.id === activeId);

  const list = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Chats</h1>
      </div>
      <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
        <input className="input" placeholder="Start a chat with @username" value={newUser} onChange={(e) => setNewUser(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') startNew(); }} style={{ minHeight: 0, borderRadius: 999, padding: '8px 14px' }} />
        <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 16px' }} onClick={startNew}>New</button>
      </div>
      {error && <p className="error-text" style={{ padding: '0 16px' }}>{error}</p>}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 && <p className="muted" style={{ padding: 16 }}>No chats yet — start one above.</p>}
        {conversations.map((c) => (
          <button key={c.id} onClick={() => openConversation(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
              border: 'none', background: c.id === activeId ? 'var(--fb-tint)' : 'transparent', padding: '10px 14px',
              borderRadius: 8,
            }}
            onMouseEnter={(e) => { if (c.id !== activeId) e.currentTarget.style.background = 'var(--fb-canvas)'; }}
            onMouseLeave={(e) => { if (c.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
          >
            <Avatar name={c.other.displayName} src={c.other.avatarUrl ?? undefined} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{c.other.displayName}</div>
              <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.lastMessage ?? 'Say hi 👋'}
              </div>
            </div>
            {c.unread > 0 && <span className="badge">{c.unread}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  const thread = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--fb-border)', padding: '10px 14px' }}>
        <button
          className="btn btn-secondary mobile-only"
          style={{ minHeight: 0, padding: '4px 10px' }}
          onClick={() => { setShowList(true); setActiveId(null); }}
          aria-label="Back to chats"
        >←</button>
        {active && <Avatar name={active.other.displayName} src={active.other.avatarUrl ?? undefined} size={36} />}
        <div>
          <div style={{ fontWeight: 600 }}>{active?.other.displayName}</div>
          <div className="muted" style={{ fontSize: 12 }}>@{active?.other.username}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {messages.map((m) => {
          const mine = m.sender.username === me;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
              <div style={{
                maxWidth: '70%', padding: '8px 13px',
                borderRadius: 18,
                borderBottomRightRadius: mine ? 4 : 18,
                borderBottomLeftRadius: mine ? 18 : 4,
                background: mine ? 'var(--fb-blue)' : 'var(--fb-surface-2)',
                color: mine ? '#fff' : 'var(--fb-text)',
                fontSize: 15,
              }}>
                {m.content}
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2, textAlign: 'right' }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--fb-border)' }}>
        <input className="input" placeholder="Aa" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) send(); }}
          style={{ borderRadius: 999 }} />
        <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 18px' }} disabled={!text.trim()} onClick={send}>Send</button>
      </div>
    </div>
  );

  return (
    <AppShell active="menu">
      <div
        className="card messages-split"
        style={{ maxWidth: 920, margin: '0 auto', width: '100%', height: 'calc(100vh - 140px)', minHeight: 420, padding: 0, overflow: 'hidden', display: 'flex' }}
      >
        <div className="msg-list" style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--fb-border)', height: '100%' }}>{list}</div>
        <div className="msg-thread" style={{ flex: 1, height: '100%' }}>{active ? thread : (
          <p className="muted" style={{ textAlign: 'center', marginTop: '45%' }}>Select a chat or start a new one.</p>
        )}</div>
      </div>
      <style>{`
        .mobile-only { display: none; }
        @media (max-width: 768px) {
          .messages-split { height: calc(100vh - 120px); }
          .mobile-only { display: inline-block; }
          .msg-list { width: 100% !important; border-right: none !important; }
          .msg-thread { display: none; }
          .messages-split.thread-open .msg-list { display: none; }
          .messages-split.thread-open .msg-thread { display: block; }
        }
      `}</style>
      <style>{`@media (max-width: 768px) { .messages-split.thread-open { height: calc(100vh - 120px); } }`}</style>
      <MobileSplit active={!!active && !showList} />
    </AppShell>
  );
}

function MobileSplit({ active }: { active: boolean }) {
  useEffect(() => {
    const el = document.querySelector('.messages-split');
    if (el) el.classList.toggle('thread-open', active);
  }, [active]);
  return null;
}
