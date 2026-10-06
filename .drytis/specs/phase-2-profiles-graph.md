# Phase 2 — Modules 03–04: Users/Profiles & Social Graph

## Module 03 — User + Profile
**Goal:** Profile pages and identity settings.

**Features:** username (unique, reserved-word check), avatar + cover image upload, bio, headline, location, website, privacy/profile mode (public/private), profile editing, view own and others' profiles; follow, unfollow, block, mute actions wired to Module 04 services.

**Acceptance criteria (running app):**
- [ ] After login, user completes onboarding/profile edit; changes persist after reload
- [ ] Avatar/cover upload displays on the profile
- [ ] Visiting /u/<username> shows that user's profile respecting privacy mode (private profile shows limited view to non-followers)
- [ ] Follow/unfollow from a profile updates follower counts immediately and persists
- [ ] Blocked users cannot follow or see the blocker's private content

**Tests:** integration (profile CRUD, privacy), E2E (edit profile → view as other user).

## Module 04 — Social Graph
**Goal:** Reusable relationship services consumed by feed/profile/discovery — no duplicated logic.

**Features:** followers/following lists, connection requests (LinkedIn-style: accept/reject), mutual connections, relationship state endpoint (none/following/mutual/blocked/pending), pagination.

**Acceptance criteria (running app):**
- [ ] User A sends connection request to B; B sees pending request; accepting makes them mutuals; rejecting/withdrawing works
- [ ] Follower/following lists paginate correctly
- [ ] Mutual-connections count shown on profiles is correct
- [ ] Blocking removes the relationship state and prevents re-follow until unblocked
- [ ] Feed and profile modules consume these services (single source of truth)

**Tests:** unit (relationship state machine), integration (request lifecycle), E2E (A→B request→accept→appears in each other's networks).
