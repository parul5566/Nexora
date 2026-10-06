# Nexora Build State — All 27 Modules COMPLETE

Project 3869, preview https://nexora-6sfqmt.drytis.dev/. Monorepo: packages/shared, apps/api (Express :4000), apps/web (Next.js standalone :3000). MySQL u1787p3869_nexora. All 27 board tickets Done as of 2026-10-04.

## Final verified state
- 66/66 API tests green across 24 suites (`RUN_MAIN=false npx vitest run` in apps/api)
- API tsc clean; shared pkg builds to dist (package.json main=dist/index.js, tsconfig noEmit=false/NodeNext)
- E2E directive chain 14/14 (register→onboarding→profile→follow→post→react→comment→notification→message→community→story→reel→professional→job apply)
- Perf: 5k perf_user* seed; all hot paths p95 < 20ms; trending cached in Redis 60s (X-Cache header)
- Security: rateLimit middleware (auth 100/min, write 240/min), securityHeaders on all API, magic-byte upload check, drafts IDOR fixed (canViewPost checks is_draft)
- SEO: robots.ts + sitemap.ts, /api/v1/seo/public-urls, SSR metadata on /u/[username] (server page.tsx + profile-client.tsx), communities/[slug], companies/[slug], jobs/[id], events/[id] (each page.tsx server wrapper + client.tsx)
- Module 24: platformAnalytics has dau/mau/retention d1/d7/d30/watchTimeSeconds/saves/connections

## Critical container quirks (READ BEFORE ANY FS WORK)
- FS is flaky: errno -74 "Bad message"/-117 "Structure needs cleaning" on random dirs. Workaround: os.rename the bad dir out of the scanned tree (rename works when delete/readdir fails). NEVER keep bad dirs under apps/web/src/app — next build scandir fails. .drytis itself corrupted once; recovered by renaming to tmp and rebuilding.
- web build: `next build src` (app dir is src/app). Served tree = apps/web/.next/standalone/apps/web (service cd's there). After build: rm -rf that .next, cp -r src/.next/. into it, procmgr restart service-bg-service-4411.
- shared package: src/index.ts imports './validation.js' — dist must exist; rebuild with /workspace/node_modules/.bin/tsc in packages/shared after edits.
- API build: /workspace/node_modules/.bin/tsc -p tsconfig.build.json (global tsc is tsgo v7, broken).
- migrations: seedPerformance.ts seeds 5k users/20k posts (perf_user*, Passw0rd!23). 017_performance.sql is idempotent (prepared-stmt guards).
- Route mount ORDER matters in server.ts: any router with router.use(requireAuth) 401s ALL later unauthenticated routes. seoRoutes mounted FIRST.
- Professional API uses snake_case fields (start_ym); jobs type is 'full-time' (hyphen); follows response is {relationship:'following'}.
- AI: OPENAI_* env keys in apps/api/.env; POST /api/v1/ai/:feature {input}, GET /ai/status.
- Flaky search test occasionally fails in full runs; rerun passes — not a code bug.
