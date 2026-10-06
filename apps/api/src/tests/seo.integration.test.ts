import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Module 23 — SEO public-urls endpoint: only public entities; no auth required.

const app = (await import('../server.js')).default as import('express').Express;

describe('SEO (Module 23)', () => {
    const emails: string[] = [];
    const tokens: Record<string, string> = {};

    async function makeUser(username: string, privacyMode: string | null) {
        username = `${username}${Date.now().toString(36).slice(-5)}`;
        const email = `${username}@seo.test`;
        emails.push(email);
        const reg = await request(app).post('/api/v1/auth/register').send({
            email, username, password: 'Passw0rd!23', displayName: username,
        });
        expect(reg.status).toBe(201);
        const vt = await request(app).post('/api/v1/auth/dev-verification-token').send({ email });
        const v = await request(app).post('/api/v1/auth/verify').send({ token: vt.body.token });
        expect(v.status).toBe(200);
        const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Passw0rd!23' });
        tokens[username] = login.body.token;
        if (privacyMode !== null) {
            await request(app).patch('/api/v1/profiles/me')
                .set('Authorization', `Bearer ${tokens[username]}`)
                .send({ privacyMode });
        }
        return tokens[username];
    }

    beforeAll(async () => {
        await makeUser('seo_pub2', 'public');
        await makeUser('seo_priv2', 'private');
    });

    it('GET /seo/public-urls requires no auth and excludes private profiles', async () => {
        const res = await request(app).get('/api/v1/seo/public-urls');
        expect(res.status).toBe(200);
        const paths: string[] = res.body.urls.map((u: any) => u.path);
        expect(paths.some((p: string) => p.startsWith('/u/seo_pub'))).toBe(true);
        expect(paths.some((p: string) => p.startsWith('/u/seo_priv'))).toBe(false);
    });

    it('returns well-formed entries', async () => {
        const res = await request(app).get('/api/v1/seo/public-urls');
        for (const u of res.body.urls) {
            expect(u.path).toMatch(/^\//);
        }
    });
});
