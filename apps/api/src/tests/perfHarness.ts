// Module 26: latency harness — hits hot endpoints on the running API and reports p50/p95.
const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4000';

async function loginAsPerfUser(): Promise<string> {
    // find a perf user and login
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'perf.user0@perf.test', password: 'Passw0rd!23' }),
    });
    if (!res.ok) throw new Error(`perf login failed: ${res.status} — seed users need email_verified + password 'Passw0rd!23'`);
    const data = await res.json();
    return data.token;
}

async function bench(name: string, fn: () => Promise<Response>, n = 30): Promise<{ name: string; p50: number; p95: number; ok: boolean }> {
    const times: number[] = [];
    let ok = true;
    for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        const res = await fn();
        const dt = performance.now() - t0;
        if (!res.ok && res.status !== 429) { ok = false; console.log('BENCH non-ok', name, res.status, await res.text().then(t=>t.slice(0,120))); }
        void res;
        times.push(dt);
    }
    times.sort((a, b) => a - b);
    const p = (q: number) => Math.round(times[Math.min(times.length - 1, Math.floor(q * times.length))]);
    return { name, p50: p(0.5), p95: p(0.95), ok };
}

async function main() {
    const token = await loginAsPerfUser();
    const auth = { Authorization: `Bearer ${token}` };
    const results = [];

    results.push(await bench('feed', () => fetch(`${BASE}/api/v1/feed?limit=20`, { headers: auth })));
    results.push(await bench('search-posts', () => fetch(`${BASE}/api/v1/search/posts?q=perf`, { headers: auth })));
    results.push(await bench('search-users', () => fetch(`${BASE}/api/v1/search/users?q=user`, { headers: auth })));
    results.push(await bench('notifications', () => fetch(`${BASE}/api/v1/notifications?limit=20`, { headers: auth })));
    results.push(await bench('messages-list', () => fetch(`${BASE}/api/v1/conversations`, { headers: auth })));
    results.push(await bench('trending-hashtags', () => fetch(`${BASE}/api/v1/trending/hashtags`, { headers: auth })));
    results.push(await bench('user-profile', () => fetch(`${BASE}/api/v1/users/perf_user123`, { headers: auth })));

    console.table(results);
    const bad = results.filter((r) => !r.ok || r.p95 > 500);
    if (bad.length) {
        console.error('PERF FAIL (>500ms p95 or errors):', bad.map((b) => b.name).join(', '));
        process.exit(1);
    }
    console.log('PERF PASS — all hot paths p95 < 500ms');
    process.exit(0);
}

void main();
