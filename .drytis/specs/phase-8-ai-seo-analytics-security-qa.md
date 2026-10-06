# Phase 8 — Modules 22–27: AI, SEO, Analytics, Security, Performance, Final QA

## Module 22 — AI Services
AI writing assistant, profile assistant, AI search, recommendations, moderation assistance, content suggestions — **behind provider-agnostic service interfaces** so providers can be swapped. Enabled via project API key infrastructure; if no key configured, features show graceful "unavailable" state and nothing breaks.

**Acceptance criteria:**
- [ ] Each AI feature is reachable through a service interface; a provider swap requires no caller changes
- [ ] Without a configured provider key, AI features degrade gracefully (no crashes, no fake output presented as AI)

## Module 23 — SEO
SSR/streaming where appropriate; metadata, canonicals, sitemaps, robots.txt, structured data, Open Graph on **public** profiles, communities, companies, jobs, articles, topic pages. Private content never exposed.

**Acceptance criteria:**
- [ ] Public profile/job/community pages render server-side with correct title/description/OG tags and canonical URL
- [ ] /sitemap.xml and /robots.txt served and include only public URLs
- [ ] A logged-out fetch of a private profile/page does not return its content in HTML

## Module 24 — Analytics
Platform analytics: DAU, MAU, retention, posts, comments, reactions, follows, connections, watch time, shares, saves, community growth, job activity. Admin + creator dashboards built on real event tracking.

**Acceptance criteria:**
- [ ] DAU/MAU computed from real session activity; spot-checkable against DB
- [ ] All listed metrics render on the admin dashboard; creator dashboard (Module 19) consumes the same tracking

## Module 25 — Security Hardening
Full pass: authN/authZ, IDOR, XSS, CSRF, SQL injection, SSRF, file upload vulns, rate limiting, session security, password security, secrets, API abuse, WebSocket authorization, admin permissions. Fix all critical issues.

**Acceptance criteria:**
- [ ] IDOR probe: requesting another user's private object by ID fails
- [ ] Stored XSS attempt in post/bio is escaped/sanitized on render
- [ ] Rate limiting returns 429 on login/post spam; WS connections require auth
- [ ] No secrets in client bundles or API responses; upload endpoints reject disguised file types

## Module 26 — Performance + Scale
Load/performance test feed, search, messaging, notifications, media, DB, Redis, WebSockets; identify bottlenecks; add caching/scaling only where justified.

**Acceptance criteria:**
- [ ] Feed, search and messaging respond within acceptable latency under a seeded multi-thousand-row dataset with indexes verified
- [ ] N+1 query hotspots fixed (query counts logged and bounded); hot paths cached in Redis

## Module 27 — Final QA
Run complete E2E workflow: New User → Register → Onboarding → Profile → Follow Users → Create Post → Receive Reactions → Comment → Receive Notification → Send Message → Join Community → Create Story → Create Reel → Professional Profile → Apply for Job — desktop and mobile.

**Acceptance criteria:**
- [ ] The full directive chain completes successfully in a browser on desktop and mobile viewport widths, with no regressions in previously verified modules
- [ ] UI/UX verification at 1440/1280/1024/768/430/390/360px: no horizontal overflow, no broken layouts, loading/error/empty states present, dark mode works, keyboard navigation works
- [ ] Migrations, typecheck, lint, unit, integration, E2E tests and production build all pass
