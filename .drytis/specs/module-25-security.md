# Module 25 — Security Hardening

Full pass over authN/authZ, IDOR, XSS, CSRF, SQLi, SSRF, uploads, rate limiting, sessions, passwords, secrets, API abuse, WS auth, admin permissions.

## Audit → fix plan
- [ ] Rate limiting: add express-rate-limit on auth (login/register/reset) and posting endpoints; 429 on spam
- [ ] IDOR: verify private-object access by ID fails (communities private posts, private profile lists) — add regression test
- [ ] XSS: React escapes by default — verify no dangerouslySetInnerHTML on user content; stored XSS test at API level (payload stored, escaped on render is client concern; API must not strip needed chars but must set CSP headers)
- [ ] Security headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy via helmet-style middleware
- [ ] Uploads: verify disguised file types rejected (extension/MIME allowlist already in mediaService — add test)
- [ ] WS: token required (already enforced 4001 on invalid) — regression-tested in module 11
- [ ] SQLi: all queries parameterized (mysql2 ? placeholders) — audit for string interpolation into SQL
- [ ] SSRF: no user-supplied URLs fetched server-side (audit)
- [ ] Admin permissions: tier checks (module 21 tests cover)
- [ ] Secrets: none hardcoded (infra verifier enforces)

## Acceptance criteria
- [ ] 429 returned on repeated login spam
- [ ] Security headers present on API responses
- [ ] IDOR probe test passes (private community content 403/404)
- [ ] Disguised upload (exe as .jpg) rejected
- [ ] No SQL string interpolation of user input found in grep audit
