import type { Metadata } from 'next';
import ProfileClient from './profile-client';

const INTERNAL_API = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';
const SITE = process.env.SITE_URL || 'https://nexora.example.com';

type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  headline: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  limited?: boolean;
};

async function getProfile(username: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/users/${encodeURIComponent(username)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile || profile.limited) {
    return { title: 'Profile | Bhasebook', robots: { index: false, follow: false } };
  }
  const title = `${profile.displayName} (@${profile.username}) | Bhasebook`;
  const description = profile.headline || profile.bio || `${profile.displayName} on Bhasebook`;
  const url = `${SITE}/u/${profile.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const profile = await getProfile(params.username);
  // Private (limited) profiles: shell only — no user content in server HTML.
  if (profile?.limited) {
    return (
      <main className="container" style={{ paddingTop: 60 }}>
        <p className="muted">This profile is private.</p>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="container" style={{ paddingTop: 60 }}>
        <p className="muted">Profile not found.</p>
      </main>
    );
  }
  return <ProfileClient username={params.username} />;
}
