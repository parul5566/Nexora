'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, Avatar } from '../../../components/shell';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nexora_token');
    if (!token) { router.replace('/login'); return; }
    fetch(`${API}/api/v1/profiles/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) { router.replace('/login'); return; }
        setProfile((await r.json()).profile);
      });
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setSaved(false);
    const token = localStorage.getItem('nexora_token');
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`${API}/api/v1/profiles/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        bio: fd.get('bio'), headline: fd.get('headline'),
        location: fd.get('location'), website: fd.get('website'),
        privacyMode: fd.get('privacyMode'),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error?.message ?? 'Save failed'); return; }
    setProfile(data.profile);
    setSaved(true);
  }

  async function onUpload(kind: 'avatar' | 'cover', file: File) {
    setUploading(true); setError('');
    const token = localStorage.getItem('nexora_token');
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API}/api/v1/profiles/me/${kind}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setError(data?.error?.message ?? 'Upload failed'); return; }
    setProfile((p: any) => ({ ...p, [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: data.url }));
  }

  if (!profile) return <AppShell active="menu"><div style={{ maxWidth: 640, margin: '0 auto', width: '100%', paddingTop: 40 }}><p className="muted">Loading…</p></div></AppShell>;

  return (
    <AppShell active="menu">
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 22 }}>Edit profile</h1>
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={profile.displayName ?? 'You'} src={profile.avatarUrl ?? undefined} size={80} />
          <div style={{ flex: 1 }}>
            <label className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px', cursor: 'pointer', display: 'inline-block' }}>
              Upload new picture
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload('avatar', e.target.files[0])} disabled={uploading} />
            </label>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label className="label" htmlFor="cover">Cover image</label>
            {profile.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.coverUrl} alt="cover" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            )}
            <label className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 16px', cursor: 'pointer', display: 'inline-block' }}>
              Upload cover
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload('cover', e.target.files[0])} disabled={uploading} />
            </label>
          </div>
        </div>
        <form className="card" onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="headline">Headline</label>
            <input id="headline" name="headline" className="input" defaultValue={profile.headline ?? ''} maxLength={160} />
          </div>
          <div className="field">
            <label className="label" htmlFor="bio">Bio</label>
            <textarea id="bio" name="bio" className="input" defaultValue={profile.bio ?? ''} maxLength={500} rows={4} />
          </div>
          <div className="field">
            <label className="label" htmlFor="location">Location</label>
            <input id="location" name="location" className="input" defaultValue={profile.location ?? ''} maxLength={120} />
          </div>
          <div className="field">
            <label className="label" htmlFor="website">Website</label>
            <input id="website" name="website" type="url" className="input" defaultValue={profile.website ?? ''} placeholder="https://" />
          </div>
          <div className="field">
            <label className="label" htmlFor="privacyMode">Profile privacy</label>
            <select id="privacyMode" name="privacyMode" className="input" defaultValue={profile.privacyMode}>
              <option value="public">Public — anyone can view</option>
              <option value="private">Private — followers only</option>
            </select>
          </div>
          <button className="btn btn-primary btn-pill" disabled={uploading}>Save profile</button>
          {saved && <p className="success-text">Saved ✓</p>}
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </AppShell>
  );
}
