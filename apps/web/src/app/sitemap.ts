import type { MetadataRoute } from 'next';

const INTERNAL_API = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';
const SITE = process.env.SITE_URL || 'https://nexora.example.com';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    '',
    '/login',
    '/register',
    '/search',
    '/jobs',
    '/companies',
    '/communities',
    '/events',
    '/reels',
  ].map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.6 }));

  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/seo/public-urls`, { cache: 'no-store' });
    if (!res.ok) return staticRoutes;
    const data = await res.json();
    const dynamicUrls = (data.urls ?? []).map((u: { path: string; lastmod?: string }) => ({
      url: `${SITE}${u.path}`,
      lastModified: u.lastmod ? new Date(u.lastmod) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.5,
    }));
    return [...staticRoutes, ...dynamicUrls];
  } catch {
    return staticRoutes;
  }
}
