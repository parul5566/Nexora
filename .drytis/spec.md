# Nexora — Master Build Blueprint

Source: Nexora Development Execution Directive (customer-supplied PDF, 22 pages, 27 modules).

## Governing rules (verbatim from directive)
- NOT a UI prototype. Each module fully implemented, integrated, tested, verified before the next.
- Flow: PLAN → DATABASE → BACKEND → API → FRONTEND → SECURITY → TESTS → INTEGRATION → VERIFY → NEXT MODULE.
- A module is NOT complete if: UI-only, fake data, missing APIs, missing persistence, bypassed auth, missing authorization, missing error states, broken mobile layout, missing tests, or broken prior functionality.
- A module IS complete only when its complete user workflow works end-to-end.
- Shared services (social graph, media, notifications) are consumed by later modules — no duplicated logic.
- Never invent credentials/API keys, never expose secrets, no mock data once real backend exists.
- After each module: run migrations, typecheck, lint, unit+integration+E2E tests, build; fix before continuing.

## Stack
- Monorepo: `/workspace` — `apps/web` (Next.js), `apps/api` (Node/Express or NestJS + WebSocket), `packages/shared` (types, validation), `packages/ui`.
- PostgreSQL (auto-provisioned MySQL on platform — see note), Redis for cache/queues.
- NOTE (platform constraint): environment provides MySQL, not PostgreSQL; use MySQL via env-provided credentials — functionally equivalent for this schema.
- Object storage for media: local disk-backed store with CDN-style static serving (platform has no S3); signed-URL pattern preserved.

## Module order (27) — build sequence per directive
01 Foundation, 02 Authentication, 03 Users+Profiles, 04 Social Graph, 05 Posting, 06 Media Pipeline, 07 Reactions+Comments, 08 Home Feed, 09 Discovery+Search, 10 Notifications, 11 Messaging, 12 Stories, 13 Reels, 14 Communities, 15 Professional Profiles, 16 Company Pages, 17 Jobs, 18 Events, 19 Creator Dashboard, 20 Moderation, 21 Admin Panel, 22 AI Services, 23 SEO, 24 Analytics, 25 Security Hardening, 26 Performance+Scale, 27 Final QA.

Full feature lists per module are in each phase spec under /workspace/.drytis/specs/.
