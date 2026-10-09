# Volume corruption recovery (recurring)

The project volume sporadically develops corrupt files (`Structure needs cleaning` / `Unknown system error -74/-117` / `Bad message` on read). Happened 5+ times (Oct 4-6). node_modules may get WIPED entirely between turns.

## Fast playbook
1. **node_modules gone** → `cd /workspace && npm install` (cache may be corrupt: `npm config set cache /tmp/.npm-cache` first; ignore rm failures on `/home/coder/.npm/_cacache`).
2. **Next 14.2.35 dist files corrupted with app-source content** (build dies with `unhandledRejection SyntaxError: Unexpected identifier 'PostView'` or `Cannot find module './parseCss'`) → after reinstall, re-copy from a clean tarball: `cd /tmp && npm pack next@14.2.35 && mkdir -p nx && tar -xzf next-14.2.35.tgz -C nx`, then:
   - `cp -r /tmp/nx/package/dist/build/webpack/plugins/wellknown-errors-plugin/* /workspace/node_modules/next/dist/build/webpack/plugins/wellknown-errors-plugin/` (if the whole dir is corrupt, `mv` it to /workspace/tmp and recreate)
   - `mkdir -p /workspace/node_modules/next/dist/lib/picocolors && cp /tmp/nx/package/dist/lib/picocolors.js → index.js` (+ .d.ts → index.d.ts), plus `cp /tmp/nx/package/dist/lib/picocolors.js /workspace/node_modules/next/dist/lib/`
   Then `cd /workspace/apps/web && rm -rf .next && npx next build`.
3. **Corrupt source files/dirs** (`Structure needs cleaning` on ls/cat/rm): `mv` the enclosing DIRECTORY to /workspace/tmp (mv of a single corrupt inode usually fails), recreate the dir, restore each file via `git -C /workspace show 'HEAD:apps/web/src/app/...'`. Corrupt paths seen so far: settings/profile/page.tsx, companies/[slug]/client.tsx, hashtag/[tag]/page.tsx, the whole src/app/jobs dir (with `page.tsx` turned into a DIRECTORY of webpack chunks, `applications` a compiled-JS file, `saved/` full of junk), `src/app/events` turned into a regular file, and src/.next + src/app_main/*_corrupt (leave those, excluded from build).
4. **Deploy routine**: build green → `cp -r .next/static .next/standalone/apps/web/.next/static` → `ln -sfn /workspace/node_modules .next/standalone/apps/node_modules` → `procmgr restart service-bg-service-4411` (web) / `4412` (api) → curl routes 200.
5. After recovery, node_modules may vanish again on next container recycle — always re-verify `ls /workspace/node_modules | wc -l` (~181) before building.
