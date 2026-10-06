# Module 23 — SEO

Public pages must render server-side with correct metadata; crawlers get sitemap + robots; private content never leaks into HTML.

## Files to change
- `apps/web/src/app/u/[username]/page.tsx` → add server component `generateMetadata` + SSR shell (public data fetched server-side), client interactivity preserved in child component
- `apps/web/src/app/communities/[slug]/page.tsx`, `companies/[slug]/page.tsx`, `jobs/[id]/page.tsx`, `events/[id]/page.tsx` → same SSR + metadata pattern
- `apps/web/src/app/robots.ts` (new) — disallow private paths, allow public
- `apps/web/src/app/sitemap.ts` (new) — static public routes + dynamic public entities from API
- `apps/api/src/seo/seoRoutes.ts` (new) — `GET /seo/public-urls` returns public-only URL list (profiles of non-private users, public communities/companies/jobs)
- Wire seoRoutes in `server.ts`

## Public API contract
- `GET /api/v1/seo/public-urls` → `{ urls: [{ path, lastmod? }] }` — NO auth required; only public/non-private entities

## Acceptance criteria
- [ ] Logged-out fetch of a public profile page contains `<title>` with display name, `og:title`, `og:description`, canonical link
- [ ] `/robots.txt` returns rules; `/sitemap.xml` returns XML with public URLs
- [ ] Logged-out fetch of a private profile page does NOT contain the user's bio/content in HTML
- [ ] Full test suite passes

## Tests
- API: seoRoutes returns only public URLs (private-privacy profiles excluded)
- Manual/HTTP: curl HTML checks above
