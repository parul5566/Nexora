# Story upload (photo/video/music) — ticket #15711, done 2026-10-09

- Stories API: POST /api/v1/stories now requires `mediaType` ('photo'|'video'|'music') whenever `mediaUrl` is sent; music URLs must end in an audio extension. Server sets expires_at = NOW() + INTERVAL 24 HOUR; feed filters expired.
- Media pipeline: media_objects.kind extended to ENUM('image','video','audio'); audio dir /media/audio; magic-byte sniffing skipped for audio (many valid containers). publicView returns mediaType.
- Migration gotcha: migrations run on API boot; a migration that was already applied manually must be registered in schema_migrations, else boot fails with ER_DUP_FIELDNAME and the API service crashes in a loop (INSERT IGNORE INTO schema_migrations fixes).
- DB creds for dev shell: user u1787p3869_user (NOT _nexora), password in apps/api/.env.
- UI test logins: /login page — Playwright: fill input[name=email/password], click 'form button.btn' (no type=submit). waitForURL '**/home'.
- Headless Chrome --dump-dom of /home returns the login redirect page (no localStorage token) — use playwright-core from /opt/node/24/lib/node_modules/@playwright/mcp/node_modules with executablePath /usr/bin/google-chrome for logged-in UI tests.
- 9:16 preview verified ratio 0.563 at 390px and 1440px.
- ffmpeg not available in container; test video/audio generated via sharp (jpg) and python wave (wav).
