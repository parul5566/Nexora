import type { Metadata } from 'next';
import Client from './client';

const INTERNAL_API = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';
const SITE = process.env.SITE_URL || 'https://nexora.example.com';

async function getEntity(p: string) {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/communities/${p}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getEntity(params.slug);
  const entity = data?.community ?? null;
  if (!entity || entity.privacy && entity.privacy !== 'public') {
    return { title: 'Bhasebook', robots: { index: false, follow: false } };
  }
  const title = `${entity.name ?? entity.title} | Bhasebook`;
  const description = String(entity.description ?? '').slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/communities/${params.slug}` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  return <Client slug={params.slug} />;
}
