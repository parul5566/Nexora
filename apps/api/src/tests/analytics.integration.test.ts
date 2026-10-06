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

describe('creator analytics (Module 19)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('dashboard aggregates real stats and enforces per-user authorization', async () => {
    const creator = await makeUser(app, 'cr');
    const fan1 = await makeUser(app, 'f1');
    const fan2 = await makeUser(app, 'f2');

    // fans follow creator
    await authed(request(app).post(`/api/v1/follows/${creator.username}`), fan1.token).expect(200);
    await authed(request(app).post(`/api/v1/follows/${creator.username}`), fan2.token).expect(200);

    // creator posts + reel
    const post = await authed(request(app).post('/api/v1/posts'))
      .send({ content: `analytics post ${unique()}` })
      .set('Authorization', `Bearer ${creator.token}`);
    expect(post.status).toBe(201);
    const postId = post.body.post.id;

    const reel = await authed(request(app).post('/api/v1/reels'))
      .send({ videoUrl: '/media/videos/reel-analytics.mp4', caption: 'analytics reel' })
      .set('Authorization', `Bearer ${creator.token}`);
    expect(reel.status).toBe(201);
    const reelId = reel.body.reel.id;

    // engagement: two reactions on post, reel views with watch seconds
    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`)).send({ type: 'like' }).set('Authorization', `Bearer ${fan1.token}`).expect(200);
    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`)).send({ type: 'love' }).set('Authorization', `Bearer ${fan2.token}`).expect(200);
    await authed(request(app).post(`/api/v1/reels/${reelId}/view`)).send({ seconds: 30 }).set('Authorization', `Bearer ${fan1.token}`).expect(200);
    await authed(request(app).post(`/api/v1/reels/${reelId}/view`)).send({ seconds: 45 }).set('Authorization', `Bearer ${fan2.token}`).expect(200);
    await authed(request(app).post(`/api/v1/reels/${reelId}/like`)).send({}).set('Authorization', `Bearer ${fan1.token}`).expect(200);

    // dashboard matches DB reality
    const dash = await authed(request(app).get('/api/v1/analytics/creator?range=all'), creator.token).expect(200);
    const postStat = dash.body.posts.find((p: any) => p.id === postId);
    expect(postStat).toBeTruthy();
    expect(postStat.reactions).toBe(2);
    expect(postStat.comments).toBe(0);

    const reelStat = dash.body.reels.find((r: any) => r.id === reelId);
    expect(reelStat).toBeTruthy();
    expect(reelStat.views).toBe(2);
    expect(reelStat.likes).toBe(1);
    expect(reelStat.watchSeconds).toBe(75);
    expect(reelStat.avgWatchSeconds).toBe(38); // round(75/2)

    expect(dash.body.audience.followers).toBeGreaterThanOrEqual(2);
    expect(dash.body.audience.newFollowers).toBeGreaterThanOrEqual(2);
    expect(dash.body.audience.watchSeconds).toBeGreaterThanOrEqual(75);
    expect(dash.body.audience.reach).toBeGreaterThanOrEqual(2);

    // per-post / per-reel analytics (owner)
    const pa = await authed(request(app).get(`/api/v1/analytics/posts/${postId}`), creator.token).expect(200);
    expect(pa.body.reactions).toBe(2);
    expect(pa.body.bookmarks).toBe(0);
    const ra = await authed(request(app).get(`/api/v1/analytics/reels/${reelId}`), creator.token).expect(200);
    expect(ra.body.watchSeconds).toBe(75);

    // authorization: another user cannot see creator's per-item analytics
    await authed(request(app).get(`/api/v1/analytics/posts/${postId}`), fan1.token).expect(404);
    await authed(request(app).get(`/api/v1/analytics/reels/${reelId}`), fan1.token).expect(404);

    // dashboard requires auth
    await request(app).get('/api/v1/analytics/creator').expect(401);

    // range validation: bad range falls back to 30d, not 500
    await authed(request(app).get('/api/v1/analytics/creator?range=bogus'), creator.token).expect(200);
  });
});
