# Module 26 — Performance + Scale

Load/performance verification of hot paths with seeded data; caching where justified; N+1 audit.

## Acceptance criteria
- [ ] Feed, search, messaging, notifications respond < 500ms p95 under seeded multi-thousand-row dataset
- [ ] Indexes exist for hot queries (feed by author/cursor, search LIKE prefix, notifications by recipient, messages by conversation)
- [ ] N+1 hotspots bounded (getPostByIds batches media/tags/mentions/polls in 5 queries, not per-post)
- [ ] Hot paths cached in Redis (trending hashtags, feed ranking metadata)

## Plan
1. Seed script: 5k users, 20k posts, 50k reactions, follows graph, 10k messages, 10k notifications
2. Latency harness (node script): p50/p95 per endpoint
3. Add missing indexes via migration 017_performance.sql
4. Redis cache for /posts/trending/hashtags and search trending
