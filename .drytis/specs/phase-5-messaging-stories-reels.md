# Phase 5 — Modules 11–13: Messaging, Stories, Reels

## Module 11 — Messaging
**Features:** conversations (1:1 DM + group), message persistence, WebSocket real-time delivery, typing indicators, online presence, delivery/read receipts, attachments (via Module 06), message search; reconnect handling, multi-session correctness.

**Acceptance criteria:**
- [ ] Two logged-in users in different sessions exchange messages in real time without refresh
- [ ] Typing indicator and online status appear and clear correctly
- [ ] Sent/delivered/read states update on the sender's UI; persists across reload
- [ ] Group conversation delivers to all members; membership changes apply
- [ ] Message with attachment renders; search within a conversation finds messages
- [ ] A dropped WebSocket reconnects and missed messages are fetched (no message loss)

## Module 12 — Stories
**Features:** image/video/text stories, story viewer with tap navigation, reactions & replies to stories, viewer list, 24h expiration via background job, privacy (public/followers/close friends).

**Acceptance criteria:**
- [ ] User posts a story; it appears in the stories bar for eligible viewers in real time
- [ ] Viewer sees who viewed; viewer list is accurate and ordered
- [ ] Story reaction/reply reaches the author as a DM/notification
- [ ] Stories older than 24h disappear (background expiry job verified)
- [ ] Privacy respected (non-follower cannot see a followers-only story)

## Module 13 — Reels
**Features:** vertical video upload (Module 06), vertical player, swipe navigation, watch/completion tracking, reactions/comments/shares/saves on reels, follow-creator CTA, recommendation feed built from collected watch events (recommendations only after watch data exists).

**Acceptance criteria:**
- [ ] Uploading a reel produces a playable vertical video in the reels feed with swipe navigation
- [ ] Watching a reel records watch/completion events (visible in data)
- [ ] Reactions, comments, save, share all work and persist
- [ ] Follow-the-creator from a reel works via Module 04
- [ ] After watch events accumulate, the reels feed orders by engagement signal; before data exists, it falls back to recent

**Tests:** integration (WS delivery, expiry job), E2E (directive chain: message→story→reel flows), multi-tab real-time test.
