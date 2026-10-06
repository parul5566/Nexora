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

async function makeUser(tag: string) {
  const u = `cm${unique()}`.slice(0, 30);
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

describe('communities (Module 14)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('create, join/leave, roles, pin, moderation, private IDOR, search exclusion', async () => {
    const a = await makeUser('a');
    const b = await makeUser('b');
    const c = await makeUser('c');

    // Public community
    const created = await authed(request(app).post('/api/v1/communities'), a.token)
      .send({ name: `Nexora Devs ${unique()}`, description: 'dev talk', rules: ['be kind'] });
    expect(created.status).toBe(201);
    const slug = created.body.community.slug;
    const communityId = created.body.community.id;
    expect(created.body.community.myRole).toBe('owner');

    // B joins public community
    const join = await authed(request(app).post(`/api/v1/communities/${slug}/join`), b.token).send();
    expect(join.status).toBe(200);
    expect(join.body.community.memberCount).toBe(2);

    // B posts to the community
    const post = await authed(request(app).post('/api/v1/posts'), b.token)
      .send({ content: 'hello community', communityId });
    expect(post.status).toBe(201);
    const postId = Number(post.body.post.id);

    // C (non-member) cannot post
    const cPost = await authed(request(app).post('/api/v1/posts'), c.token)
      .send({ content: 'sneak', communityId });
    expect(cPost.status).toBe(403);

    // Member cannot pin or assign roles
    const bPin = await authed(request(app).post(`/api/v1/communities/${slug}/posts/${postId}/pin`), b.token).send();
    expect(bPin.status).toBe(403);
    const bRole = await authed(request(app).post(`/api/v1/communities/${slug}/members/${b.username}/role`), b.token)
      .send({ role: 'admin' });
    expect(bRole.status).toBe(403);

    // Owner promotes B to admin; admin can pin; pinned first in feed; unpin works
    const promote = await authed(request(app).post(`/api/v1/communities/${slug}/members/${b.username}/role`), a.token)
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);
    const pin = await authed(request(app).post(`/api/v1/communities/${slug}/posts/${postId}/pin`), b.token).send();
    expect(pin.status).toBe(200);
    expect(pin.body.pinned).toBe(true);
    const feed = await authed(request(app).get(`/api/v1/communities/${slug}/posts`), a.token);
    expect(feed.status).toBe(200);
    expect(Number(feed.body.posts[0].id)).toBe(postId); // pinned first
    const unpin = await authed(request(app).post(`/api/v1/communities/${slug}/posts/${postId}/pin`), b.token)
      .send({ pinned: false });
    expect(unpin.body.pinned).toBe(false);

    // Moderator can moderate-delete
    await authed(request(app).post(`/api/v1/communities/${slug}/members/${b.username}/role`), a.token)
      .send({ role: 'moderator' });
    const del = await authed(request(app).post(`/api/v1/communities/${slug}/posts/${postId}/moderate`), b.token).send();
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    // Private community IDOR
    const priv = await authed(request(app).post('/api/v1/communities'), a.token)
      .send({ name: `Secret Circle ${unique()}`, privacy: 'private' });
    expect(priv.status).toBe(201);
    const privSlug = priv.body.community.slug;
    const privPost = await authed(request(app).post('/api/v1/posts'), a.token)
      .send({ content: 'private secret marker', communityId: priv.body.community.id });
    expect(privPost.status).toBe(201);

    const cFeed = await authed(request(app).get(`/api/v1/communities/${privSlug}/posts`), c.token);
    expect(cFeed.status).toBe(403);

    // Private community posts excluded from search for non-member
    const search = await authed(request(app).get('/api/v1/search/posts?q=private secret marker'), c.token);
    expect(search.status).toBe(200);
    expect(search.body.items ?? []).toHaveLength(0);

    // Member CAN see private content after invite+accept
    const invite = await authed(request(app).post(`/api/v1/communities/${privSlug}/invite`), a.token)
      .send({ username: b.username });
    expect(invite.status).toBe(200);
    const accept = await authed(request(app).post(`/api/v1/communities/${privSlug}/invite/accept`), b.token).send();
    expect(accept.status).toBe(200);
    const bFeed = await authed(request(app).get(`/api/v1/communities/${privSlug}/posts`), b.token);
    expect(bFeed.status).toBe(200);
    expect(bFeed.body.posts).toHaveLength(1);

    // Owner cannot leave
    const leave = await authed(request(app).post(`/api/v1/communities/${slug}/leave`), a.token).send();
    expect(leave.status).toBe(400);

    // B leaves public community
    const leaveB = await authed(request(app).post(`/api/v1/communities/${slug}/leave`), b.token).send();
    expect(leaveB.status).toBe(200);
    const after = await authed(request(app).get(`/api/v1/communities/${slug}`), a.token);
    expect(after.body.community.memberCount).toBe(1);
  }, 30000);
});
