# Client-side exception verification method

The "Application error: a client-side exception" screenshot (#15608, 2026-10-09) did NOT reproduce after the 04:43 deploy — root cause was almost certainly a stale cached bundle from the pre-restart build. Verification method that works in this container:

- `google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 --dump-dom <url>` then grep for "Application error" — real browser hydration test, sweeps any route. Use for any future "client exception" report BEFORE changing code.
- Also sweep chunk assets: extract `src="/_next/..."` from each route's HTML and curl each (404 chunk = crash).
- `procmgr restart service-bg-service-4411` + user hard-refresh (cache) resolves most stale-bundle reports.

Hardened in #15608: reels/page.tsx FollowInline no longer reads localStorage/JSON.parse at render scope (moved into useEffect with try/catch) — that was the only SSR/corrupt-storage-unsafe pattern in the codebase. All other localStorage usage is already inside useEffect/handlers.

Never name a variable `q` check confusion: shell.tsx topbar-search input has name="q" — false positive in icon-name grep.
