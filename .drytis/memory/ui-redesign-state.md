# Nexora corruption round 2 + secondary-page sweep (Oct 6, 2026)

Ticket #14848 (UI Redesign 9) DONE: all secondary pages now on the FB design system with AppShell — /search (pill search + tab counts + trending chips), /reels, /bookmarks, /hashtag/[tag], /events + detail (pill RSVPs), /jobs + detail/saved/applications (color-coded status), /analytics, /admin, /companies + detail, /communities/[slug]. All 21 routes 200.

Corruption incident #2 (volume recycle destroyed more files):
- `/workspace/apps/api/src/search` and `src/posts` became unreadable ("Structure needs cleaning", Errno -117/117); `src/db/migrations/003_posts.sql` lost.
- Recovery pattern that WORKS:
  1. Rebuild src tree entry-by-entry with python copytree, skipping entries that raise Errno 117 (mv of the whole dir fails if ANY entry is unreadable — even python os.rename of parent works only same-device).
  2. Recover lost TS sources from `dist/**/*.js` (compiled output survives!): copy .js → .ts, strip sourceMappingURL, add `// @ts-nocheck` on line 1.
  3. Recreate lost migration SQL from the LIVE MySQL DDL (`SHOW CREATE TABLE`, information_schema COLUMNS/STATISTICS/KEY_COLUMN_USAGE/REFERENTIAL_CONSTRAINTS).
  4. Re-add type exports (PostView/PostInput in postService) by grepping consumer imports.
  5. vitest scans the whole tree — quarantine corrupt dirs into `apps/api/quarantine/` and run `npx vitest run --exclude '**/quarantine/**'` (vitest.config has no exclude; passing --exclude works).
- Post-repair state: 20 test files / 45 tests green (down from 24/66 — some post-module test files lost with corruption; engagement/posts verified live via API: create post, hashtag, search, feed all working).
- web build cache can throw EIO during builds on this volume — just re-run `npm run build`, it succeeds on retry. After build: copy .next/static AND .next/server into .next/standalone/apps/web/.next/ then restart service-bg-service-4411.

Reminder: publish after each verified ticket — unpushed source was lost to corruption before.