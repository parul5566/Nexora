import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_NAME ??= process.env.TEST_DB_NAME || 'u1787p3869_nexora';
process.env.DB_USER ??= 'u1787p3869_user';
process.env.DB_PASSWORD ??= 'HrRmEjUwsmBvnVvx';
process.env.RUN_MAIN = 'false';

let app: any;
const unique = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-12);

async function makeUser(app: any, tag: string) {
  const u = `${tag}${unique()}`.slice(0, 30);
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: `${u}@test.io`, password: 'longenough1', username: u, displayName: `User ${tag}` });
  await request(app).post('/api/v1/auth/verify').send({ token: reg.body.verifyToken });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: `${u}@test.io`, password: 'longenough1' });
  return { username: u, token: login.body.token as string };
}

const authed = (req: any, token: string) => req.set('Authorization', `Bearer ${token}`);

describe('connections (Module 04)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('connection request lifecycle: request → accept → connected; reject & withdraw', async () => {
    const a = await makeUser(app, 'ca');
    const b = await makeUser(app, 'cb');

    // A requests B
    const req1 = await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    expect(req1.status).toBe(200);
    expect(req1.body.relationship).toBe('pending_outgoing');

    // duplicate request blocked
    const dup = await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    expect(dup.status).toBe(409);

    // B sees pending_incoming and accepts
    expect((await authed(request(app).get(`/api/v1/relationship/${a.username}`), b.token)).body.relationship).toBe('pending_incoming');
    const acc = await authed(request(app).post(`/api/v1/connections/${a.username}/accept`), b.token);
    expect(acc.status).toBe(200);
    expect(acc.body.relationship).toBe('connected');

    // mutual count
    const rel = await authed(request(app).get(`/api/v1/relationship/${b.username}`), a.token);
    expect(rel.body.relationship).toBe('connected');
    expect(Number(rel.body.mutualCount)).toBeGreaterThanOrEqual(0);

    // remove connection
    const rem = await authed(request(app).delete(`/api/v1/connections/${b.username}`), a.token);
    expect(rem.status).toBe(200);
    expect((await authed(request(app).get(`/api/v1/relationship/${b.username}`), a.token)).body.relationship).toBe('none');

    // reject path
    await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    const rej = await authed(request(app).post(`/api/v1/connections/${a.username}/reject`), b.token);
    expect(rej.status).toBe(200);
    expect((await authed(request(app).get(`/api/v1/relationship/${b.username}`), a.token)).body.relationship).toBe('none');

    // withdraw path
    await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    const wd = await authed(request(app).delete(`/api/v1/connections/${b.username}`), a.token);
    expect(wd.status).toBe(200);
    expect((await authed(request(app).get(`/api/v1/relationship/${b.username}`), a.token)).body.relationship).toBe('none');
  });

  it('connection actions require auth', async () => {
    const res = await request(app).post('/api/v1/connections/someone/request');
    expect(res.status).toBe(401);
  });

  it('blocking strips connections and blocks re-request until unblocked', async () => {
    const a = await makeUser(app, 'da');
    const b = await makeUser(app, 'db');
    await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    await authed(request(app).post(`/api/v1/connections/${a.username}/accept`), b.token);

    await authed(request(app).post(`/api/v1/blocks/${b.username}`), a.token);
    expect((await authed(request(app).get(`/api/v1/relationship/${b.username}`), a.token)).body.relationship).toBe('blocked');

    const req2 = await authed(request(app).post(`/api/v1/connections/${a.username}/request`), b.token);
    expect(req2.status).toBe(403);

    await authed(request(app).delete(`/api/v1/blocks/${b.username}`), a.token);
    const req3 = await authed(request(app).post(`/api/v1/connections/${a.username}/request`), b.token);
    expect(req3.status).toBe(200);
  });

  it('pending incoming requests are listed', async () => {
    const a = await makeUser(app, 'ea');
    const b = await makeUser(app, 'eb');
    await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token);
    const list = await authed(request(app).get('/api/v1/connections/requests/incoming'), b.token);
    expect(list.status).toBe(200);
    expect(list.body.requests.some((r: any) => r.username === a.username)).toBe(true);
  });
});
