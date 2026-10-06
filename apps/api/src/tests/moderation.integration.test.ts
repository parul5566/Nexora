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

describe('moderation (Module 20)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('report → moderate → restore chain with permissions and audit trail', async () => {
    const author = await makeUser(app, 'ma');
    const reporter = await makeUser(app, 'mr');
    const normal = await makeUser(app, 'mn');

    // Grant moderator + admin roles to fresh users
    const mod = await makeUser(app, 'mo');
    const admin = await makeUser(app, 'ad');
    const { pool } = await import('../db/database.js');
    const [modId]: any = await pool.query('SELECT id FROM users WHERE username = ?', [mod.username]);
    const [admId]: any = await pool.query('SELECT id FROM users WHERE username = ?', [admin.username]);
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [Number(modId[0].id), 'moderator']);
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [Number(admId[0].id), 'admin']);

    // Author posts content
    const post = await authed(request(app).post('/api/v1/posts'))
      .send({ content: `bad post ${unique()}` })
      .set('Authorization', `Bearer ${author.token}`);
    expect(post.status).toBe(201);
    const postId = post.body.post.id;

    // Non-moderators cannot access moderation APIs
    await authed(request(app).get('/api/v1/moderation/reports'), normal.token).expect(403);
    await authed(request(app).post(`/api/v1/moderation/reports/1/act`)).send({ action: 'remove_content' }).set('Authorization', `Bearer ${normal.token}`).expect(403);
    await authed(request(app).get('/api/v1/moderation/audit'), normal.token).expect(403);
    await request(app).get('/api/v1/moderation/reports').expect(401);

    // Reporter reports the post
    const rep = await authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'post', objectId: postId, reason: 'spam content' })
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(rep.status).toBe(201);
    const reportId = rep.body.id;

    // Duplicate identical report coexists (returns same id)
    const dup = await authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'post', objectId: postId, reason: 'spam content' })
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(dup.status).toBe(201);
    expect(dup.body.id).toBe(reportId);

    // Empty reason rejected
    await authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'post', objectId: postId, reason: '  ' })
      .set('Authorization', `Bearer ${reporter.token}`).expect(400);

    // Moderator sees the queue
    const queue = await authed(request(app).get('/api/v1/moderation/reports'), mod.token).expect(200);
    const entry = queue.body.reports.find((r: any) => r.id === reportId);
    expect(entry).toBeTruthy();
    expect(entry.status).toBe('open');

    // Moderator removes the content
    await authed(request(app).post(`/api/v1/moderation/reports/${reportId}/act`))
      .send({ action: 'remove_content', note: 'confirmed spam' })
      .set('Authorization', `Bearer ${mod.token}`).expect(200);

    // Content is gone for everyone (soft delete hides it from the read path)
    const others = await authed(request(app).get(`/api/v1/posts/${postId}`), normal.token);
    expect([404, 410]).toContain(others.status);
    await authed(request(app).get(`/api/v1/posts/${postId}`), author.token).expect(404);

    // Report is now resolved — acting again fails
    await authed(request(app).post(`/api/v1/moderation/reports/${reportId}/act`))
      .send({ action: 'restore_content' })
      .set('Authorization', `Bearer ${mod.token}`).expect(400);

    // Restore reverses the removal
    await authed(request(app).post('/api/v1/moderation/restore'))
      .send({ objectType: 'post', objectId: postId })
      .set('Authorization', `Bearer ${mod.token}`).expect(200);
    await authed(request(app).get(`/api/v1/posts/${postId}`), normal.token).expect(200);

    // User-level moderation: report the author, restrict, ban (admin only)
    const [authorId]: any = await pool.query('SELECT id FROM users WHERE username = ?', [author.username]);
    const uid = Number(authorId[0].id);
    const urep = await authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'user', objectId: uid, reason: 'abusive user' })
      .set('Authorization', `Bearer ${reporter.token}`);
    expect(urep.status).toBe(201);
    const urepId = urep.body.id;

    // Moderator cannot ban — admin only
    await authed(request(app).post(`/api/v1/moderation/reports/${urepId}/act`))
      .send({ action: 'ban' })
      .set('Authorization', `Bearer ${mod.token}`).expect(403);

    await authed(request(app).post(`/api/v1/moderation/reports/${urepId}/act`))
      .send({ action: 'restrict' })
      .set('Authorization', `Bearer ${mod.token}`).expect(200);
    const [statusRow]: any = await pool.query('SELECT status FROM users WHERE id = ?', [uid]);
    expect(statusRow[0].status).toBe('restricted');

    // Fresh user report → suspend → cannot log in; ban by admin → cannot log in
    const bad = await makeUser(app, 'mb');
    const [badId]: any = await pool.query('SELECT id FROM users WHERE username = ?', [bad.username]);
    const brep = await authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'user', objectId: Number(badId[0].id), reason: 'bot' })
      .set('Authorization', `Bearer ${reporter.token}`);
    await authed(request(app).post(`/api/v1/moderation/reports/${brep.body.id}/act`))
      .send({ action: 'suspend' })
      .set('Authorization', `Bearer ${admin.token}`).expect(200);
    await request(app).post('/api/v1/auth/login')
      .send({ email: `${bad.username}@test.io`, password: 'longenough1' }).expect(403);
    await authed(request(app).post(`/api/v1/moderation/reports/${brep.body.id}/act`).send({ action: 'ban' }), admin.token).expect(400); // already resolved

    const [b2rep] = await Promise.all([authed(request(app).post('/api/v1/reports'))
      .send({ objectType: 'user', objectId: Number(badId[0].id), reason: 'bot again' })
      .set('Authorization', `Bearer ${reporter.token}`)]);
    await authed(request(app).post(`/api/v1/moderation/reports/${b2rep.body.id}/act`))
      .send({ action: 'ban' })
      .set('Authorization', `Bearer ${admin.token}`).expect(200);
    await request(app).post('/api/v1/auth/login')
      .send({ email: `${bad.username}@test.io`, password: 'longenough1' }).expect(403);

    // Audit trail records everything with actor + timestamp
    const audit = await authed(request(app).get('/api/v1/moderation/audit'), admin.token).expect(200);
    const actions = audit.body.actions;
    expect(actions.some((a: any) => a.action === 'remove_content' && a.objectId === String(postId) && a.moderator === mod.username)).toBe(true);
    expect(actions.some((a: any) => a.action === 'restore_content' && a.objectId === String(postId))).toBe(true);
    expect(actions.some((a: any) => a.action === 'ban' && a.targetUser === bad.username && a.moderator === admin.username)).toBe(true);
    for (const a of actions) expect(a.createdAt).toBeTruthy();
  });
});
