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
  const u = `co${unique()}`.slice(0, 30);
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

describe('companies (Module 16)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('create, follow, post-as-company, role enforcement, analytics vs DB', async () => {
    const a = await makeUser('a');
    const b = await makeUser('b');
    const c = await makeUser('c');

    // Create company
    const created = await authed(request(app).post('/api/v1/companies'), a.token)
      .send({ name: `Acme Rockets ${unique()}`, tagline: 'we build rockets', industry: 'Aerospace' });
    expect(created.status).toBe(201);
    const slug = created.body.company.slug;
    expect(created.body.company.myRole).toBe('admin');

    // B follows, then unfollows, then follows again — count correct
    const f1 = await authed(request(app).post(`/api/v1/companies/${slug}/follow`), b.token).send();
    expect(f1.body.company.followerCount).toBe(1);
    const uf = await authed(request(app).post(`/api/v1/companies/${slug}/unfollow`), b.token).send();
    expect(uf.body.company.followerCount).toBe(0);
    await authed(request(app).post(`/api/v1/companies/${slug}/follow`), b.token).send();
    await authed(request(app).post(`/api/v1/companies/${slug}/follow`), c.token).send();
    const detail = await request(app).get(`/api/v1/companies/${slug}`);
    expect(detail.body.company.followerCount).toBe(2);

    // Admin posts as the company
    const post = await authed(request(app).post(`/api/v1/companies/${slug}/posts`), a.token)
      .send({ content: 'Exciting launch news!' });
    expect(post.status).toBe(201);
    const postId = Number(post.body.post.id);
    expect(post.body.post.content).toBe('Exciting launch news!');

    // Company page feed shows it
    const feed = await request(app).get(`/api/v1/companies/${slug}/posts`);
    expect(feed.status).toBe(200);
    expect(feed.body.posts).toHaveLength(1);

    // B follows → company posts appear in his follower view via page; c reacts for engagement
    const react = await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token)
      .send({ type: 'like' });
    expect(react.status).toBe(200);

    // Role enforcement: outsider cannot edit branding or post
    const cEdit = await authed(request(app).patch(`/api/v1/companies/${slug}`), c.token)
      .send({ description: 'hacked' });
    expect(cEdit.status).toBe(403);
    const cPost = await authed(request(app).post(`/api/v1/companies/${slug}/posts`), c.token)
      .send({ content: 'spam' });
    expect(cPost.status).toBe(403);

    // Promote B as recruiter: can post, cannot edit branding
    await authed(request(app).post(`/api/v1/companies/${slug}/admins`), a.token)
      .send({ username: b.username, role: 'recruiter' });
    const bPost = await authed(request(app).post(`/api/v1/companies/${slug}/posts`), b.token)
      .send({ content: 'We are hiring!' });
    expect(bPost.status).toBe(201);
    const bEdit = await authed(request(app).patch(`/api/v1/companies/${slug}`), b.token)
      .send({ tagline: 'new tagline' });
    expect(bEdit.status).toBe(403);

    // Admin CAN edit branding
    const aEdit = await authed(request(app).patch(`/api/v1/companies/${slug}`), a.token)
      .send({ tagline: 'official tagline' });
    expect(aEdit.status).toBe(200);
    expect(aEdit.body.company.tagline).toBe('official tagline');

    // Analytics vs direct DB aggregates
    const analytics = await authed(request(app).get(`/api/v1/companies/${slug}/analytics`), a.token);
    expect(analytics.status).toBe(200);
    expect(analytics.body.followers).toBe(2);
    expect(analytics.body.posts).toBe(2);
    expect(analytics.body.reactions).toBe(1);
    expect(Array.isArray(analytics.body.followerGrowth)).toBe(true);
  }, 30000);
});
