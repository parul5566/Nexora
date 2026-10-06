import type { MetadataRoute } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL || process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.SITE_URL || 'https://nexora.example.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/settings',
          '/messages',
          '/notifications',
          '/admin',
          '/analytics',
          '/bookmarks',
          '/home',
          '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

// keep API referenced for tree-shaking clarity
export const revalidate = 3600;
void API;
