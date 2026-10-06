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
const uidOf = async (username: string): Promise<number> => {
  const { pool } = await import('../db/database.js');
  const [rows]: any = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  return Number(rows[0].id);
};

describe('admin panel (Module 21)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('role/permission matrix: normal user 403, super full, limited tier restricted', async () => {
    const normal = await makeUser(app, 'an');
    const superAdmin = await makeUser(app, 'as');
    const limitedAdmin = await makeUser(app, 'al');

    await poolRoles(superAdmin.username, 'admin');
    await poolRoles(limitedAdmin.username, 'moderator');

    // Normal users get 403 on EVERY admin route
    for (const path of ['/admin/me', '/admin/users?q=a', '/admin/analytics', '/admin/audit', '/admin/reports', '/admin/content/post']) {
      const res = await authed(request(app).get('/api/v1'+path), normal.token);
      expect(res.status).toBe(403);
    }
    await request(app).get('/api/v1/admin/analytics').expect(401);

    // Super admin tier
    const me = await authed(request(app).get('/api/v1/admin/me'), superAdmin.token).expect(200);
    expect(me.body.tier).toBe('super');

    // User management: search + suspend + unsuspend (audited)
    const target = await makeUser(app, 'at');
    const search = await authed(request(app).get(`/api/v1/admin/users?q=${target.username.slice(0, 10)}`), superAdmin.token).expect(200);
    const found = search.body.users.find((u: any) => u.username === target.username);
    expect(found).toBeTruthy();
    const tid = await uidOf(target.username);
    await authed(request(app).post(`/api/v1/admin/users/${tid}/status`))
      .send({ status: 'suspended' }).set('Authorization', `Bearer ${superAdmin.token}`).expect(200);
    await request(app).post('/api/v1/auth/login')
      .send({ email: `${target.username}@test.io`, password: 'longenough1' }).expect(403);
    await authed(request(app).post(`/api/v1/admin/users/${tid}/status`))
      .send({ status: 'active' }).set('Authorization', `Bearer ${superAdmin.token}`).expect(200);
    await request(app).post('/api/v1/auth/login')
      .send({ email: `${target.username}@test.io`, password: 'longenough1' }).expect(200);

    // Content management: remove a post
    const post = await authed(request(app).post('/api/v1/posts'))
      .send({ content: `admin content test ${unique()}` })
      .set('Authorization', `Bearer ${target.token}`);
    const pid = post.body.post.id;
    await authed(request(app).post(`/api/v1/admin/content/post/${pid}`))
      .send({ action: 'remove' }).set('Authorization', `Bearer ${superAdmin.token}`).expect(200);
    await authed(request(app).get(`/api/v1/posts/${pid}`), normal.token).expect(404);
    await authed(request(app).post(`/api/v1/admin/content/post/${pid}`))
      .send({ action: 'restore' }).set('Authorization', `Bearer ${superAdmin.token}`).expect(200);
    await authed(request(app).get(`/api/v1/posts/${pid}`), normal.token).expect(200);

    // Limited admin: can view reports + analytics + audit, cannot manage users/content
    const meL = await authed(request(app).get('/api/v1/admin/me'), limitedAdmin.token).expect(200);
    expect(meL.body.tier).toBe('limited');
    await authed(request(app).get('/api/v1/admin/reports'), limitedAdmin.token).expect(200);
    await authed(request(app).get('/api/v1/admin/analytics'), limitedAdmin.token).expect(200);
    await authed(request(app).get('/api/v1/admin/audit'), limitedAdmin.token).expect(200);
    await authed(request(app).post(`/api/v1/admin/users/${tid}/status`))
      .send({ status: 'suspended' }).set('Authorization', `Bearer ${limitedAdmin.token}`).expect(403);
    await authed(request(app).post(`/api/v1/admin/content/post/${pid}`))
      .send({ action: 'remove' }).set('Authorization', `Bearer ${limitedAdmin.token}`).expect(403);
    await authed(request(app).get('/api/v1/admin/users?q=x'), limitedAdmin.token).expect(403);

    // System analytics: real platform aggregates
    const stats = await authed(request(app).get('/api/v1/admin/analytics'), superAdmin.token).expect(200);
    expect(stats.body.users).toBeGreaterThanOrEqual(4);
    expect(stats.body.posts).toBeGreaterThanOrEqual(1);
    expect(typeof stats.body.openReports).toBe('number');

    // Audit log records admin actions with actor + timestamp
    const audit = await authed(request(app).get('/api/v1/admin/audit'), superAdmin.token).expect(200);
    expect(audit.body.actions.some((a: any) => a.action === 'suspend' && a.moderator === superAdmin.username)).toBe(true);
    expect(audit.body.actions.some((a: any) => a.action === 'remove_content' && a.objectId === String(pid) && a.moderator === superAdmin.username)).toBe(true);
  });
});

async function poolRoles(username: string, role: 'admin' | 'moderator') {
  const { pool } = await import('../db/database.js');
  const [rows]: any = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  await pool.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [Number(rows[0].id), role]);
}
