# FB dark-mode UI parity — ticket #15740, done 2026-10-09

- Design tokens now dark: canvas #18191A, surface #242526, surface-2 #3A3B3C (borders/hover/chips/secondary btns), text #E4E6EB, secondary #B0B3B8, link #4599FF. Base theme is dark app-wide via :root.
- Hydration bug root cause: app/messages/page.tsx had `{typeof document !== 'undefined' && <style>…}` + empty dangerouslySetInnerHTML <script> → React #418/#423 on /messages ONLY (every load). Rule: never render client-only elements in SSR trees; static <style> blocks are fine.
- friends page used /connections/requests/requests (404) — real endpoints: /connections/requests/incoming and /outgoing.
- analytics page used credentials:'include' — API auth is Bearer token from localStorage, not cookies.
- stories bar <img> must only render for mediaType photo (video/music get ♪/▶ placeholder tile).
- API rate limit: authLimiter 100/min per (IP,route) shared bucket — automated sweeps self-induce 429s on /conversations + /notifications/unread-count; NOT a bug. Space sweeps ≥70s apart.
- vitest: run with `npx vitest run --dir src/tests` (default glob scans quarantine/ and hits ENOTDIR on corrupt files).
- Test login via Playwright: fill input[name=email/password] on /login, click 'form button.btn', waitForURL '**/home'. Token in localStorage 'nexora_token'.
- Profile header rebuilt FB-style: bleeding cover, centered avatar/name/counts, Add to story (blue) + Edit profile (dark) 50/50, single-row scrollable underline tabs. postsCount not in API yet (optional field, hidden when absent).
