import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_NAME ??= process.env.TEST_DB_NAME || 'u1787p3869_nexora';
process.env.DB_USER ??= 'u1787p3869_user';
process.env.DB_PASSWORD ??= 'HrRmEjUwsmBvnVvx';
process.env.RUN_MAIN = 'false';

let app: any;
const sentEmails: Array<{ to: string; subject: string; body: string }> = [];

const unique = () => `t${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe('auth API', () => {
  beforeAll(async () => {
    // capture tokens from the log mail transport
    const { logger } = await import('../logger.js');
    const orig = logger.info.bind(logger);
    logger.info = (msg: string, meta?: unknown) => {
      if (msg === 'email (log transport)' && meta) sentEmails.push(meta as any);
      orig(msg, meta);
    };
    app = (await import('../server.js')).default;
  });

  const lastTokenTo = (email: string) =>
    [...sentEmails].reverse().find((e) => e.to === email)!.body.split(': ')[1];

  it('register → verify → login → me → logout', async () => {
    const u = unique();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${u}@test.io`, password: 'longenough1', username: u, displayName: 'Test User' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.emailVerified).toBe(false);
    expect(reg.body.user).not.toHaveProperty('password_hash');

    const ver = await request(app)
      .post('/api/v1/auth/verify')
      .send({ token: lastTokenTo(`${u}@test.io`) });
    expect(ver.status).toBe(200);

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${u}@test.io`, password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${u}@test.io`, password: 'longenough1' });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(u);

    const noAuth = await request(app).get('/api/v1/me');
    expect(noAuth.status).toBe(401);

    const sessions = await request(app).get('/api/v1/auth/sessions').set('Authorization', `Bearer ${token}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.sessions.length).toBeGreaterThanOrEqual(1);

    const out = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);

    const meAfter = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(meAfter.status).toBe(401);
  });

  it('password reset flow works', async () => {
    const u = unique();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `${u}@test.io`, password: 'longenough1', username: u, displayName: 'T' });
    await request(app).post('/api/v1/auth/verify').send({ token: lastTokenTo(`${u}@test.io`) });

    await request(app).post('/api/v1/auth/password/reset-request').send({ email: `${u}@test.io` });
    const reset = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: lastTokenTo(`${u}@test.io`), password: 'newlongpass1' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${u}@test.io`, password: 'newlongpass1' });
    expect(login.status).toBe(200);
  });

  it('rejects duplicate email and reserved username', async () => {
    const u = unique();
    const body = { email: `${u}@test.io`, password: 'longenough1', username: u, displayName: 'T' };
    expect((await request(app).post('/api/v1/auth/register').send(body)).status).toBe(201);
    const dupEmail = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, username: `${u}x` });
    expect(dupEmail.status).toBe(409);
    const reserved = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, email: `x${u}@test.io`, username: 'admin' });
    expect(reserved.status).toBe(400);
  });
});
