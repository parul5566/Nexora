'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/shell';

interface PostStat { id: string; type: string; excerpt: string; reactions: number; comments: number; score: number }
interface ReelStat { id: string; caption: string; views: number; likes: number; watchSeconds: number; avgWatchSeconds: number }
interface StoryStat { id: string; views: number }
interface Dash {
  range: string;
  posts: PostStat[];
  reels: ReelStat[];
  stories: StoryStat[];
  audience: { followers: number; following: number; newFollowers: number; reach: number; engagement: number; watchSeconds: number };
}

const RANGES = ['7d', '30d', '90d', 'all'] as const;

function fmtWatch(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function CreatorDashboard() {
  const [range, setRange] = useState<(typeof RANGES)[number]>('30d');
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: string) => {
    setError(null);
    const res = await fetch(`/api/v1/analytics/creator?range=${r}`, { credentials: 'include' });
    if (!res.ok) {
      setError(res.status === 401 ? 'Please log in to view your dashboard.' : `Failed to load dashboard (${res.status})`);
      return;
    }
    setDash(await res.json());
  }, []);

  useEffect(() => { void load(range); }, [range, load]);

  const a = dash?.audience;

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Creator Dashboard</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              className={`btn ${r === range ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRange(r)}
            >
              {r === 'all' ? 'All time' : `Last ${r}`}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!dash && !error && <p>Loading analytics…</p>}

      {dash && a && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '16px 0' }}>
            {[
              { label: 'Followers', value: a.followers },
              { label: `New followers (${dash.range})`, value: a.newFollowers },
              { label: 'Reach', value: a.reach },
              { label: 'Engagements', value: a.engagement },
              { label: 'Watch time', value: fmtWatch(a.watchSeconds) },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--bg-alt, #f5f6f8)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 17 }}>Posts ({dash.posts.length})</h2>
          {dash.posts.length === 0 && <p style={{ opacity: 0.6 }}>No posts in this range.</p>}
          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {dash.posts.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.excerpt || `(${p.type})`}</span>
                <span>❤ {p.reactions}</span>
                <span>💬 {p.comments}</span>
                <span title="engagement score">⭐ {p.score}</span>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 17 }}>Reels ({dash.reels.length})</h2>
          {dash.reels.length === 0 && <p style={{ opacity: 0.6 }}>No reels in this range.</p>}
          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {dash.reels.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.caption || '(reel)'}</span>
                <span>▶ {r.views}</span>
                <span>❤ {r.likes}</span>
                <span title="total / avg watch time">⏱ {fmtWatch(r.watchSeconds)} · {r.avgWatchSeconds}s avg</span>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 17 }}>Stories ({dash.stories.length})</h2>
          {dash.stories.length === 0 && <p style={{ opacity: 0.6 }}>No stories in this range.</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dash.stories.map((s) => (
              <div key={s.id} style={{ padding: '6px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8 }}>
                Story #{s.id} · 👁 {s.views}
              </div>
            ))}
          </div>
        </>
      )}
      </div>
      </div>
    </AppShell>
  );
}
