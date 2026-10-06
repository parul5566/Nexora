# Phase 1 — Modules 01–02: Foundation & Authentication

## Module 01 — Foundation
**Goal:** Monorepo skeleton where frontend runs, backend runs, DB connects, migrations run, API responds, production build succeeds.

**Files/structure:** `apps/web` (Next.js), `apps/api` (Node + HTTP + WS), `packages/shared` (TypeScript types + zod validation), `packages/ui` (design tokens, Button/Input/Card primitives, dark mode), `.env` handling, logger, global error handler, `/api/v1/health` endpoint, DB migration tooling, Redis client.

**Acceptance criteria (running app):**
- [ ] Visiting the site URL loads the Next.js app shell (no error page)
- [ ] `GET /api/v1/health` returns 200 with DB and Redis connectivity status
- [ ] A migration can be run against the database successfully
- [ ] The API builds for production (`build` script passes) and typecheck/lint pass

## Module 02 — Authentication
**Goal:** Real auth with sessions.

**Features:** register (email+password, validation), email verification token flow, login, logout, password reset (token), password change, session management, device session list + revoke, 2FA-ready architecture (optional TOTP), OAuth stubs behind an interface.

**Acceptance criteria (running app):**
- [ ] A new user can register, verify email, log in, and log out
- [ ] Invalid credentials are rejected with a clear error
- [ ] Password reset via emailed token sets a new password that logs in
- [ ] Private API endpoints return 401 without a valid session
- [ ] User can see active device sessions and revoke one; revoked session is logged out
- [ ] Passwords are hashed; no secrets in responses

**Tests:** unit (validation, hashing), integration (auth endpoints, 401/403), E2E (register→verify→login→logout→reset).
