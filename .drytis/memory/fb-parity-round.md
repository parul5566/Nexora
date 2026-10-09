# Nexora — FB/LinkedIn parity round (tickets #15600–#15607, all Done)

Key root causes fixed (keep in mind for future regressions):
- Messenger: web origin had no /ws rewrite → added `{source:'/ws', destination:'http://127.0.0.1:4000/ws'}` to apps/web/next.config.mjs; wsHub now validates conversation participants (isParticipant in messaging/messageService.ts).
- Follow button never switched: backend `relationshipState` returns a plain STRING ('self|blocked|blocked_by|connected|pending_outgoing|pending_incoming|mutuals|following|followed_by|none'), NOT {following, connectionState}. Frontend normalizes via normalizeRelationship() in apps/web/src/app/u/[username]/profile-client.tsx. Any new UI reading relationship must handle the string form.
- listFollows signature is now (userId, kind, viewerId, cursor, limit) and returns items[].isFollowing — used by profile follower/following tabs and Friends screen.
- New endpoints: GET /connections/requests/outgoing (listPendingOutgoing in social/graphService.ts).
- Reels: hydrate() includes author.isFollowing; POST /reels/:id/view registers views (called by IntersectionObserver >60% visibility in reels/page.tsx).
- Jobs: post-a-job UI uses GET /companies?limit=50 filtered to myRole to list postable companies (company creator becomes 'admin'). ApplyInline calls POST /jobs/:id/apply with empty JSON body.

Verified E2E (all via web origin port 3000):
- WS: participant receives message frames; non-participant gets HTTP 403 on send and no frames.
- follow/unfollow, reject→re-request, accept→connected→remove all 200 with correct relationship strings.
- Group create/join/post/pin/role-change all 200. Job create/apply/applicants all working.

QA accounts (also in /workspace/.drytis/cred.json): qafeed1@test.io / Qafeed@123; qamsg4@test.io / Qamsg@123.

Routes without pages (404 by design): /stories, /watch (reels lives at /reels), /saved (bookmarks lives at /bookmarks).
After any apps/web build: cp -r .next/static .next/standalone/apps/web/.next/ then restart service-bg-service-4411. Shared must be compiled before API build. See volume-corruption-recovery.md for the corruption playbook (still recurring: node_modules wipes, corrupt source files restored via `git -C /workspace show 'HEAD:<path>'`).
