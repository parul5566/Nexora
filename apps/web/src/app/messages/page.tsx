'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell, Avatar } from '../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface Conversation { id: string; other: { username: string; displayName: string; avatarUrl: string | null }; lastMessage: string | null; unread: number; }
interface Message { id: string; sender: { username: string }; content: string; createdAt: string; }
interface RequestItem { id: string; from: { username: string; displayName: string; avatarUrl: string | null } | null; preview: string | null; lastMessageAt: string | null; }

function MessagesInner() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [newUser, setNewUser] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true); // mobile: list vs thread
  const [folder, setFolder] = useState<'primary' | 'requests'>('primary');
  const [reqInfo, setReqInfo] = useState<{ canAccept: boolean } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const deepLinkHandled = useRef(false);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('nexora_token') ?? '';
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch(`${API}/api/v1/conversations/requests`, { headers: authHeaders() });
    if (res.ok) setRequests((await res.json()).requests);
  }, [authHeaders]);

  const loadConversations = useCallback(async () => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    const res = await fetch(`${API}/api/v1/conversations`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setConversations((await res.json()).conversations);
    setLoading(false);
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { window.location.href = '/login'; return; }
    fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMe(d.user.username));
    loadConversations();
  }, [loadConversations]);

  // Deep link: /messages?c=<username> opens (or creates) the thread with that user.
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const cUser = searchParams.get('c');
    if (!cUser) return;
    deepLinkHandled.current = true;
    (async () => {
      const token = localStorage.getItem('nexora_token');
      if (!token) { window.location.href = '/login'; return; }
      const existing = conversations.find((cv) => cv.other.username === cUser);
      if (existing) { openConversation(existing.id); return; }
      const res = await fetch(`${API}/api/v1/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: cUser }),
      });
      if (res.ok) {
        const { id } = await res.json();
        await loadConversations();
        await new Promise((r) => setTimeout(r, 300));
        openConversation(id);
      } else {
        setError((await res.json().catch(() => ({})))?.error?.message ?? 'Could not open chat');
      }
      // strip ?c= from the URL without re-render loops
      router.replace('/messages');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, conversations]);

  const openConversation = useCallback(async (id: string) => {
    const token = localStorage.getItem('nexora_token')!;
    setActiveId(id);
    setShowList(false);
    wsRef.current?.close();
    const res = await fetch(`${API}/api/v1/conversations/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMessages((await res.json()).messages);
    // request-state banner for pending threads
    fetch(`${API}/api/v1/conversations/${id}/request`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setReqInfo(d && d.status === 'pending' ? d : null))
      .catch(() => setReqInfo(null));
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

  async function respond(accept: boolean) {
    if (!activeId) return;
    const token = localStorage.getItem('nexora_token')!;
    const res = await fetch(`${API}/api/v1/conversations/${activeId}/${accept ? 'accept' : 'decline'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (accept) {
        setReqInfo(null);
        loadConversations();
      } else {
        setShowList(true); setActiveId(null); setMessages([]); setReqInfo(null);
        loadConversations();
      }
    }
  }

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

  const active = conversations.find((c) => c.id === activeId)
    // pending deep-link threads aren't in the accepted list — render the thread anyway
    ?? (activeId && messages.length >= 0
      ? {
          id: activeId,
          other: (requests.find((r) => r.id === activeId)?.from) ?? { username: '', displayName: 'Conversation', avatarUrl: null },
          lastMessage: null, unread: 0,
        }
      : null);

  const reqCount = requests.length;

  const list = (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Chats</h1>
        {loading && <p className="connecting-note" aria-live="polite" style={{ margin: '6px 0 0' }}>Network connecting…</p>}
      </div>
      {/* Folder tabs: Primary / Requests (Instagram-style) */}
      <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', borderBottom: '1px solid var(--fb-border)' }}>
        <button
          className="chip"
          aria-selected={folder === 'primary'}
          onClick={() => setFolder('primary')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >Primary</button>
        <button
          className="chip"
          aria-selected={folder === 'requests'}
          onClick={() => { setFolder('requests'); loadRequests(); }}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          Requests
          {reqCount > 0 && (
            <span style={{
              background: '#E41E3F', color: '#fff', borderRadius: 999, fontSize: 11,
              fontWeight: 700, minWidth: 18, height: 18, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 5px',
            }}>{reqCount}</span>
          )}
        </button>
      </div>
      {folder === 'primary' && (<>
      <div style={{ padding: '8px 12px 8px', display: 'flex', gap: 6 }}>
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
      </>)}
      {folder === 'requests' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {requests.length === 0 && <p className="muted" style={{ padding: 16 }}>No message requests.</p>}
          {requests.map((r) => (
            <button key={r.id}
              onClick={async () => {
                // Viewing the thread marks it visible; open it read-only with Accept/Decline.
                setFolder('primary');
                await loadConversations();
                openConversation(r.id);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                border: 'none', background: 'transparent', padding: '10px 14px', borderRadius: 8,
              }}
            >
              <Avatar name={r.from?.displayName ?? '?'} src={r.from?.avatarUrl ?? undefined} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.from?.displayName ?? 'Unknown'}</div>
                <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.preview ?? 'Sent a message request'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
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
      {reqInfo && reqInfo.canAccept && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--fb-tint)', borderBottom: '1px solid var(--fb-border)' }}>
          <span className="muted" style={{ fontSize: 13, flex: 1 }}>Message request</span>
          <button className="btn" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => respond(true)}>Accept</button>
          <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => respond(false)}>Decline</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--fb-border)' }}>
        <input className="input" placeholder="Aa" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) send(); }}
          style={{ borderRadius: 999 }}
          disabled={!!reqInfo && reqInfo.canAccept}
        />
        <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 18px' }} disabled={!text.trim() || (!!reqInfo && reqInfo.canAccept)} onClick={send}>Send</button>
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

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  );
}
