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

describe('notifications (Module 10)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('reaction + comment create notifications; dedupe keeps one; unread count + mark read', async () => {
    const a = await makeUser(app, 'na'); // recipient
    const b = await makeUser(app, 'nb'); // actor
    const post = await authed(request(app).post('/api/v1/posts'), a.token).send({ content: 'notify me' });
    const postId = post.body.post.id;

    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token).send({ type: 'like' });
    await authed(request(app).post(`/api/v1/posts/${postId}/comments`), b.token).send({ content: 'a comment' });
    // duplicate reaction event (change type) should NOT create a second notification
    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token).send({ type: 'love' });

    const list = await authed(request(app).get('/api/v1/notifications'), a.token);
    expect(list.status).toBe(200);
    const types = list.body.notifications.map((n: any) => n.type).sort();
    expect(types).toContain('reaction');
    expect(types).toContain('comment');
    expect(list.body.notifications.filter((n: any) => n.type === 'reaction').length).toBe(1); // deduped
    expect(list.body.unread).toBeGreaterThanOrEqual(2);
    expect(list.body.notifications[0].actor.username).toBe(b.username);

    // mark one read
    const firstId = list.body.notifications[0].id;
    const mark = await authed(request(app).post('/api/v1/notifications/read'), a.token)
      .send({ ids: [firstId] });
    expect(mark.body.updated).toBe(1);
    const after = await authed(request(app).get('/api/v1/notifications'), a.token);
    expect(after.body.unread).toBe(list.body.unread - 1);
  });

  it('follow + connection + mention notifications; no self-notifications', async () => {
    const a = await makeUser(app, 'nc');
    const b = await makeUser(app, 'nd');

    // no self-notification on own post activity
    const own = await authed(request(app).post('/api/v1/posts'), a.token).send({ content: 'self post' });
    await authed(request(app).post(`/api/v1/posts/${own.body.post.id}/reactions`), a.token).send({ type: 'like' });
    let list = await authed(request(app).get('/api/v1/notifications'), a.token);
    expect(list.body.notifications.length).toBe(0);

    // follow
    await authed(request(app).post(`/api/v1/follows/${a.username}`), b.token).expect(200);
    // repeat follow → still one notification (INSERT IGNORE affectedRows=0)
    await authed(request(app).post(`/api/v1/follows/${a.username}`), b.token).expect(200);

    // connection request + accept
    await authed(request(app).post(`/api/v1/connections/${a.username}/request`), b.token).expect(200);
    await authed(request(app).post(`/api/v1/connections/${b.username}/accept`), a.token).expect(200);

    // mention
    await authed(request(app).post('/api/v1/posts'), b.token)
      .send({ content: `hey @${a.username} look` });

    list = await authed(request(app).get('/api/v1/notifications'), a.token);
    const types = list.body.notifications.map((n: any) => n.type);
    expect(types).toContain('follow');
    expect(types).toContain('connection_request');
    expect(types).toContain('mention');
    expect(list.body.notifications.filter((n: any) => n.type === 'follow').length).toBe(1);

    // the requester (b) gets the accept notification
    const bList = await authed(request(app).get('/api/v1/notifications'), b.token);
    expect(bList.body.notifications.map((n: any) => n.type)).toContain('connection_accept');

    // mark all read
    await authed(request(app).post('/api/v1/notifications/read'), a.token).send({ all: true });
    const final = await authed(request(app).get('/api/v1/notifications'), a.token);
    expect(final.body.unread).toBe(0);
  });
});
