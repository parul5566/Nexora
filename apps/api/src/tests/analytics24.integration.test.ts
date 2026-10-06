import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Module 24 — Analytics: DAU/MAU from real session activity, retention structure,
// creator analytics endpoint authorization.

const app = (await import('../server.js')).default as import('express').Express;

const ADMIN_EMAIL = 'admin.analytics@test.dev';

async function setupAdmin() {
    // create admin user via register + direct role grant through db service table
    const email = ADMIN_EMAIL;
    const reg = await request(app).post('/api/v1/auth/register').send({
        email, username: `analyticsadmin${Date.now().toString(36).slice(-5)}`,
        password: 'Passw0rd!23', displayName: 'Analytics Admin',
    });
    if (reg.status === 409) {
        // role may have been granted on an earlier run — just log in
        const l = await request(app).post('/api/v1/auth/login').send({ email, password: 'Passw0rd!23' });
        if (l.status === 200) {
            const check = await request(app).get('/api/v1/admin/analytics').set('Authorization', `Bearer ${l.body.token}`);
            if (check.status === 200) return l.body.token;
        }
        return null;
    }
    const vt = await request(app).post('/api/v1/auth/dev-verification-token').send({ email });
    await request(app).post('/api/v1/auth/verify').send({ token: vt.body.token });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Passw0rd!23' });
    const token = login.body.token as string;
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    const userId = me.body.user.id;
    const { pool } = await import('../db/database.js');
    await pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES (?, 'admin') ON DUPLICATE KEY UPDATE role='admin'",
        [BigInt(userId)]
    );
    return token;
}

describe('Analytics (Module 24)', () => {
    it('admin analytics includes DAU/MAU, retention, watch time, saves', async () => {
        const token = await setupAdmin();
        expect(token).toBeTruthy();
        const res = await request(app).get('/api/v1/admin/analytics').set('Authorization', `Bearer ${token!}`);
        expect(res.status).toBe(200);
        const a = res.body;
        expect(typeof a.dau).toBe('number');
        expect(typeof a.mau).toBe('number');
        expect(a.dau).toBeGreaterThanOrEqual(1); // this very login session counts
        expect(a.mau).toBeGreaterThanOrEqual(a.dau);
        expect(a.retention).toHaveProperty('day1');
        expect(a.retention).toHaveProperty('day7');
        expect(a.retention).toHaveProperty('day30');
        expect(typeof a.watchTimeSeconds).toBe('number');
        expect(typeof a.saves).toBe('number');
        expect(a.connections).toBeGreaterThanOrEqual(0);
    });

    it('non-admin cannot access platform analytics', async () => {
        const email = `plainuser${Date.now().toString(36).slice(-5)}@analytics.test`;
        await request(app).post('/api/v1/auth/register').send({
            email, username: `plain${Date.now().toString(36).slice(-5)}`,
            password: 'Passw0rd!23', displayName: 'Plain',
        });
        const vt = await request(app).post('/api/v1/auth/dev-verification-token').send({ email });
        await request(app).post('/api/v1/auth/verify').send({ token: vt.body.token });
        const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Passw0rd!23' });
        const res = await request(app).get('/api/v1/admin/analytics').set('Authorization', `Bearer ${login.body.token}`);
        expect(res.status).toBe(403);
    });

    it('creator analytics requires auth', async () => {
        const res = await request(app).get('/api/v1/analytics/creator');
        expect(res.status).toBe(401);
    });
});
