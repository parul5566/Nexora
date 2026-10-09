import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { pool } from '../db/database.js';

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

describe('stories (Module 12)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('create text + media stories, feed groups by author with seen state, view tracking, viewers list, delete', async () => {
    const a = await makeUser(app, 'sta'); // author
    const b = await makeUser(app, 'stb'); // viewer, follows a
    await authed(request(app).post(`/api/v1/follows/${a.username}`), b.token).expect(200);

    const text = await authed(request(app).post('/api/v1/stories'), a.token)
      .send({ bgText: 'hello story', bgColor: '#ff0055' });
    expect(text.status).toBe(201);
    expect(text.body.story.bgText).toBe('hello story');
    expect(text.body.story.expiresAt).toBeTruthy();

    const media = await authed(request(app).post('/api/v1/stories'), a.token)
      .send({ mediaUrl: '/media/images/7c6df26f4ae378e7701fef9d.png', mediaType: 'photo' });
    expect(media.status).toBe(201);
    expect(media.body.story.mediaType).toBe('photo');

    // validation
    const bad = await authed(request(app).post('/api/v1/stories'), a.token).send({});
    expect(bad.status).toBe(400);
    const badUrl = await authed(request(app).post('/api/v1/stories'), a.token)
      .send({ mediaUrl: 'https://evil.com/x.png' });
    expect(badUrl.status).toBe(400);

    // b's feed groups a's stories, unseen
    const feed = await authed(request(app).get('/api/v1/stories/feed'), b.token);
    expect(feed.status).toBe(200);
    const group = feed.body.groups.find((g: any) => g.author.username === a.username);
    expect(group).toBeTruthy();
    expect(group.stories.length).toBe(2);
    expect(group.allSeen).toBe(false);

    // b views one story → that story seen, group still not allSeen
    const firstId = group.stories[0].id;
    await authed(request(app).post(`/api/v1/stories/${firstId}/view`), b.token).expect(200);
    const feed2 = await authed(request(app).get('/api/v1/stories/feed'), b.token);
    const g2 = feed2.body.groups.find((g: any) => g.author.username === a.username);
    expect(g2.stories.find((s: any) => s.id === firstId).seen).toBe(true);
    expect(g2.allSeen).toBe(false);

    // author sees viewer count + viewer list
    const viewers = await authed(request(app).get(`/api/v1/stories/${firstId}/viewers`), a.token);
    expect(viewers.status).toBe(200);
    expect(viewers.body.viewers.map((v: any) => v.username)).toContain(b.username);

    // non-author cannot list viewers
    const viewersB = await authed(request(app).get(`/api/v1/stories/${firstId}/viewers`), b.token);
    expect(viewersB.status).toBe(403);

    // author deletes own story; other user cannot delete
    const delB = await authed(request(app).delete(`/api/v1/stories/${firstId}`), b.token);
    expect(delB.status).toBe(403);
    const del = await authed(request(app).delete(`/api/v1/stories/${firstId}`), a.token);
    expect(del.status).toBe(200);
    const feed3 = await authed(request(app).get('/api/v1/stories/feed'), b.token);
    const g3 = feed3.body.groups.find((g: any) => g.author.username === a.username);
    expect(g3.stories.length).toBe(1);
  });

  it('expired stories excluded from feed and user endpoint', async () => {
    const a = await makeUser(app, 'stc');
    const b = await makeUser(app, 'std');
    await authed(request(app).post(`/api/v1/follows/${a.username}`), b.token).expect(200);

    const s = await authed(request(app).post('/api/v1/stories'), a.token).send({ bgText: 'dying story' });
    // backdate expiry
    await pool.query('UPDATE stories SET expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [s.body.story.id]);

    const feed = await authed(request(app).get('/api/v1/stories/feed'), b.token);
    expect(feed.body.groups.find((g: any) => g.author.username === a.username)).toBeUndefined();

    const mine = await authed(request(app).get(`/api/v1/stories/user/${a.username}`), a.token);
    expect(mine.body.group).toBeNull();
  });

  it('user stories endpoint returns own + others active stories', async () => {
    const a = await makeUser(app, 'ste');
    const s = await authed(request(app).post('/api/v1/stories'), a.token).send({ bgText: 'mine' });
    const mine = await authed(request(app).get(`/api/v1/stories/user/${a.username}`), a.token);
    expect(mine.body.group.isSelf).toBe(true);
    expect(mine.body.group.stories.some((x: any) => x.id === s.body.story.id)).toBe(true);
  });
});
