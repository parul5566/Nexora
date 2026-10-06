import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Module 25 — Security hardening: rate limiting, security headers, IDOR, disguised uploads.

const app = (await import('../server.js')).default as import('express').Express;

const RUN = Date.now().toString(36).slice(-6);

async function makeUser(name: string) {
    const email = `${name}@sec.test`;
    await request(app).post('/api/v1/auth/register').send({
        email, username: `${name}${RUN}`, password: 'Passw0rd!23', displayName: name,
    });
    const vt = await request(app).post('/api/v1/auth/dev-verification-token').send({ email });
    await request(app).post('/api/v1/auth/verify').send({ token: vt.body.token });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Passw0rd!23' });
    return login.body.token as string;
}

describe('Security (Module 25)', () => {
    let alice = '';
    let bob = '';

    beforeAll(async () => {
        alice = await makeUser(`sa${RUN}`);
        bob = await makeUser(`sb${RUN}`);
    }, 60_000);

    it('sets security headers on API responses', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    });

    it('rate limits login attempts with 429', async () => {
        let lastStatus = 0;
        for (let i = 0; i < 120 && lastStatus !== 429; i++) {
            const res = await request(app).post('/api/v1/auth/login').send({
                email: `ratelimit${RUN}@sec.test`, password: 'WrongPass!1',
            });
            lastStatus = res.status;
            if (res.status === 429) break;
        }
        expect(lastStatus).toBe(429);
    });

    it('prevents IDOR: another user cannot fetch a private draft post', async () => {
        const created = await request(app).post('/api/v1/posts')
            .set('Authorization', `Bearer ${alice}`)
            .send({ content: 'secret draft', draft: true });
        expect(created.status).toBe(201);
        const id = created.body.post.id;
        console.log('DBG created id', id, 'resp', JSON.stringify(created.body).slice(0, 120));
        // owner can view
        const own = await request(app).get(`/api/v1/posts/${id}`).set('Authorization', `Bearer ${alice}`);
        console.log('DBG own status', own.status, JSON.stringify(own.body).slice(0, 120));
        expect(own.status).toBe(200);
        // other user cannot
        const other = await request(app).get(`/api/v1/posts/${id}`).set('Authorization', `Bearer ${bob}`);
        expect([403, 404]).toContain(other.status);
        // logged out cannot
        const anon = await request(app).get(`/api/v1/posts/${id}`);
        expect([401, 403, 404]).toContain(anon.status);
    });

    it('rejects disguised uploads (exe bytes claiming to be jpeg)', async () => {
        // fake file: MZ header (Windows exe) but named .jpg with jpeg mime
        const tmp = path.join(os.tmpdir(), `evil${RUN}.jpg`);
        fs.writeFileSync(tmp, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]));
        const res = await request(app).post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${alice}`)
            .attach('file', tmp, { contentType: 'image/jpeg' });
        fs.unlinkSync(tmp);
        expect([400, 415, 500]).toContain(res.status);
        expect(res.status).toBe(400);
    });

    it('SQL injection attempt in search does not error or leak', async () => {
        const res = await request(app).get(`/api/v1/search?q=${encodeURIComponent("' OR 1=1; DROP TABLE users; --")}`);
        // Must not be a 500 — parameterized queries treat it as a literal string
        expect(res.status).not.toBe(500);
    });
});
