# Phase 4 — Modules 08–10: Feed, Search, Notifications

## Module 08 — Home Feed
**Features:** "Following" feed (from Module 04 graph) first; then "For You" ranked feed; cursor pagination; ranking service (freshness, engagement, relationship/interest signals, negative feedback); feed caching (Redis, invalidated on new posts/unfollows).

**Acceptance criteria:**
- [ ] Following feed shows posts only from followed users, newest-first, paginating via cursor (no duplicates/missing across pages)
- [ ] For You feed ranks recently-engaged content higher; ranking is a real service, not hardcoded order
- [ ] New post by a followed user appears in the follower's feed (cache invalidation works)
- [ ] Hide/negative-feedback action demotes that content
- [ ] Empty states (new user, no follows) render onboarding guidance

## Module 09 — Discovery + Search
**Features:** global search across people, posts, communities, companies, topics, hashtags, jobs; autocomplete; ranking; search history; filters; pagination.

**Acceptance criteria:**
- [ ] Typing in the search bar returns autocomplete suggestions within a fast, debounced response
- [ ] Full search returns grouped results per type with pagination; results match query terms in the DB
- [ ] Filters (type tabs) narrow correctly; private content of other users is NOT searchable
- [ ] Recent searches appear and can be cleared

## Module 10 — Notifications
**Features:** event-driven service with typed events (LIKE_CREATED, COMMENT_CREATED, FOLLOW_CREATED, CONNECTION_ACCEPTED, MESSAGE_RECEIVED, MENTION_CREATED); in-app notification list; read/unread + unread badge; preferences (mute types); push/email architecture behind interfaces (stub transport OK).

**Acceptance criteria:**
- [ ] Each event type above produces a notification for the right recipient (actor ≠ recipient; self-actions don't notify)
- [ ] Notification list shows unread styling; marking read persists; badge count is correct
- [ ] Disabling a preference stops new notifications of that type
- [ ] Notification links deep-link to the source object (post/comment/profile)

**Tests:** unit (event→notification mapping), integration (fan-out), E2E (directive chain: register→login→profile→post→in feed→other reacts→notification received).
