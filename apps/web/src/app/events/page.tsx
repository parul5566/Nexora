'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/shell';

export interface Event {
  id: number; title: string; description: string | null; privacy: 'public' | 'private';
  location: string | null; onlineUrl: string | null; startsAt: string; endsAt: string | null;
  going: number; interested: number; myRsvp: string | null; creator: string;
}

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

function when(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/events', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Failed');
      setEvents(data.events);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setError('');
    const body: Record<string, unknown> = { title, startsAt, privacy };
    if (location) body.location = location;
    if (onlineUrl) body.onlineUrl = onlineUrl;
    const res = await fetch('/api/v1/events', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (res.ok) { setTitle(''); setStartsAt(''); setLocation(''); setOnlineUrl(''); load(); }
    else { const d = await res.json().catch(() => ({})); setError(d?.error?.message ?? 'Failed'); }
  }

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Events</h1>
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Create event</p>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <input className="input" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <input className="input" placeholder="Online link (optional)" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <select className="input" style={{ width: 'auto', minHeight: 0, padding: '8px 10px' }} value={privacy} onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <button className="btn btn-primary btn-pill" onClick={create} disabled={!title.trim() || !startsAt} style={{ minHeight: 0, padding: '8px 20px' }}>Create</button>
        {error && <p className="error-text">{error}</p>}
      </div>
      {events.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href={`/events/${e.id}`} style={{ fontWeight: 600, color: 'var(--fb-text)', fontSize: 16 }}>{e.title}</Link>
            {e.privacy === 'private' && <span className="fb-chip" style={{ fontSize: 11, padding: '2px 8px' }}>Private</span>}
          </div>
          <p className="muted" style={{ margin: '6px 0', fontSize: 14 }}>📅 {when(e.startsAt)}{e.location ? ` · 📍 ${e.location}` : ''} · by @{e.creator}</p>
          <span style={{ fontSize: 14 }}>{e.going} going · {e.interested} interested{e.myRsvp ? ` · You: ${e.myRsvp}` : ''}</span>
        </div>
      ))}
      {events.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><p className="muted">No events yet — create the first one above.</p></div>
      )}
      </div>
    </AppShell>
  );
}
