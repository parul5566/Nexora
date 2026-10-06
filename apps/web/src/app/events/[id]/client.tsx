'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../../components/shell';

interface Event {
  id: number; title: string; description: string | null; privacy: 'public' | 'private';
  location: string | null; onlineUrl: string | null; startsAt: string; endsAt: string | null;
  going: number; interested: number; myRsvp: string | null; creator: string;
}

interface Attendee { username: string; displayName: string; status: string }
interface Comment { id: number; text: string; username: string; display_name: string; created_at: string }

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function EventDetailPage({ id }: { id: string }) {
    const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/events/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Not found');
      setEvent(data.event);
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/v1/events/${id}/attendees`, { headers: authHeaders() }),
        fetch(`/api/v1/events/${id}/comments`, { headers: authHeaders() }),
      ]);
      if (aRes.ok) setAttendees((await aRes.json()).attendees);
      if (cRes.ok) setComments((await cRes.json()).comments);
    } catch (e: any) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function rsvp(status: string) {
    const res = await fetch(`/api/v1/events/${id}/rsvp`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message ?? 'Failed'); return; }
    setNotice(`RSVP: ${status}`);
    load();
  }

  async function comment() {
    await fetch(`/api/v1/events/${id}/comments`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ text }) });
    setText('');
    load();
  }

  async function invite() {
    const res = await fetch(`/api/v1/events/${id}/invite`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ username: inviteName }) });
    if (res.ok) { setNotice(`Invited @${inviteName}`); setInviteName(''); }
    else { const d = await res.json().catch(() => ({})); setNotice(d?.error?.message ?? 'Invite failed'); }
  }

  const shell = (children: React.ReactNode) => (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>{children}</div>
    </AppShell>
  );
  if (error) return shell(<p className="error-text">{error}</p>);
  if (!event) return shell(<p className="muted">Loading…</p>);

  return shell(
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>{event.title} {event.privacy === 'private' && <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px' }}>Private</span>}</h1>
        <p>{event.description}</p>
        <p className="muted">{new Date(event.startsAt).toLocaleString()}{event.location ? ` · ${event.location}` : ''} · by @{event.creator}</p>
        {event.onlineUrl && <p><a href={event.onlineUrl} target="_blank" rel="noopener noreferrer">Join online</a></p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={event.myRsvp === 'going' ? 'btn btn-primary btn-pill' : 'btn btn-secondary'} style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => rsvp('going')}>Going ({event.going})</button>
          <button className={event.myRsvp === 'interested' ? 'btn btn-primary btn-pill' : 'btn btn-secondary'} style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => rsvp('interested')}>Interested ({event.interested})</button>
          <button className="btn btn-secondary" style={{ minHeight: 0, padding: '6px 14px' }} onClick={() => rsvp('not')}>Not going</button>
        </div>
        {notice && <p className="fb-chip" style={{ marginTop: 8 }}>{notice}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input placeholder="Invite by username" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <button className="btn btn-secondary" onClick={invite} disabled={!inviteName.trim()}>Invite</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Discussion</h3>
        {comments.map((c) => (
          <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <strong>@{c.username}</strong> <span className="muted">{new Date(String(c.created_at)).toLocaleString()}</span>
            <p>{c.text}</p>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary btn-pill" style={{ minHeight: 0, padding: '8px 16px' }} onClick={comment} disabled={!text.trim()}>Post</button>
        </div>
      </div>

      <div className="card">
        <h3>Attendees</h3>
        {attendees.map((a) => (
          <div key={a.username} style={{ padding: '4px 0' }}>
            <a href={`/u/${a.username}`} style={{ color: 'var(--fb-text)' }}>{a.displayName}</a> <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px' }}>{a.status}</span>
          </div>
        ))}
        {attendees.length === 0 && <p className="muted">No RSVPs yet.</p>}
      </div>
    </>
  );
}
