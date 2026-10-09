# Facebook Parity Pass — Groups, Reels, Messenger, Composer, Connections, Jobs

Root-cause findings from researcher audit:

1. **Messenger broken:** client connects WS to `window.location.origin/ws`, but Next rewrites only `/api/v1/*` and `/media/*` — no `/ws` rewrite. Upgrade never reaches the API's WebSocketServer. Fix: add `ws:true` rewrite for `/ws` in next.config + validate participant in wsHub.
2. **Follow button bug:** backend `relationshipState()` returns a string ('following'|'mutuals'|'followed_by'|...), profile code checks `relationship?.following` (object) → always undefined → button never flips to "Following", unfollow never fires. Fix: treat as string; show Following+Unfollow when `['following','mutuals'].includes(r)`; show Follow again after a rejected request (backend already allows re-request; re-follow always allowed).
3. **Requests UI:** no outgoing-requests endpoint/UI; Friends screen fetch paths are correct — the "load ni hoti" complaint needs the screen rebuilt FB-style with skeleton/loading states + Requests tab incl. outgoing with Cancel.
4. **Followers/Following:** endpoints fine; profile shows only followers labeled "Friends" — add proper Followers/Following tab lists.
5. **Groups:** functionality exists; redesign to FB Groups screen per mockup: header "Groups" + create/search, tabs For you / Your groups / Discover, joined-group rows with avatar + new-post meta + pin, recommended cards with Join.
6. **Reels:** rebuild as full-screen vertical snap feed: right engagement rail (like/comment/share/save/more with counts), creator row with Follow pill, autoplay via IntersectionObserver, swipe/scroll to next.
7. **Composer:** modernize — avatar + "What's on your mind" opener, live preview card with photo grid, action row.
8. **Jobs:** add Post-a-job UI (endpoint exists), LinkedIn-style list cards + detail with Apply/Save; fix type filter values.

Test account: qafeed1@test.io / Qafeed@123 (verified). cred.json updated.
