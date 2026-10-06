# Phase 3 — Modules 05–07: Posting, Media, Reactions/Comments

## Module 05 — Posting System
**Features:** text, image, video, link-preview posts; polls (vote, results); @mentions (resolve to users, notify via Module 10); #hashtags (extracted, indexed for search); visibility (public/followers/private); edit (with "edited" marker), delete, drafts, save/bookmark.

**Acceptance criteria:**
- [ ] User creates each post type; it persists and renders correctly after reload
- [ ] Mentions link to profiles; hashtags are tappable and lead to a hashtag feed
- [ ] Poll voting updates results and prevents double-voting
- [ ] Edit shows an edited indicator with prior state not silently lost; delete removes post everywhere
- [ ] Drafts save and can be published later; bookmarked posts appear in a saved list
- [ ] Visibility settings respected (followers-only post not visible to strangers)

## Module 06 — Media Pipeline
**Features:** upload → signed URL → object storage → processing queue → image/video processor → CDN-style serving; resizing, thumbnails, multiple resolutions; upload progress; MIME/size validation; no large media in the database.

**Acceptance criteria:**
- [ ] Uploading an image returns progress and ends with a served, resized image + thumbnail
- [ ] Uploading a video produces a playable processed variant
- [ ] Oversized or disallowed-MIME uploads are rejected with clear errors
- [ ] Media is served via storage/CDN URLs; DB stores only metadata/pointers
- [ ] Failed processing surfaces an error state, not a broken image forever

## Module 07 — Reactions + Comments
**Features:** reactions (like/love/etc.), reaction picker, one-reaction-per-user enforced (unique constraint), change/remove reaction; comments with nested replies (bounded depth), edit/delete, moderation hooks, counts, optimistic UI.

**Acceptance criteria:**
- [ ] Reacting to a post updates the count instantly (optimistic) and persists
- [ ] Switching reaction type replaces (never duplicates) the user's reaction — verified in DB
- [ ] Comment, reply, edit, delete all persist; deleted comment's replies handled per policy
- [ ] Counts (reactions, comments) are accurate everywhere shown

**Tests:** unit (reaction uniqueness), integration (comment tree), E2E (post → react → comment → reply → notification flows connect with Module 10).
