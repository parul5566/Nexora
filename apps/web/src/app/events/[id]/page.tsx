import type { Metadata } from 'next';
import Client from './client';

const INTERNAL_API = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';
const SITE = process.env.SITE_URL || 'https://nexora.example.com';

async function getEntity(p: string) {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/events/${p}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await getEntity(params.id);
  const entity = data?.event ?? null;
  if (!entity || entity.privacy && entity.privacy !== 'public') {
    return { title: 'Nexora', robots: { index: false, follow: false } };
  }
  const title = `${entity.name ?? entity.title} | Nexora`;
  const description = String(entity.description ?? '').slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/events/${params.id}` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  return <Client id={params.id} />;
}
