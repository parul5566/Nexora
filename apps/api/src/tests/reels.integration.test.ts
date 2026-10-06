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

describe('reels (Module 13)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('create, feed with liked flag, like toggle, views, author-only delete, video-only validation', async () => {
    const a = await makeUser(app, 'ra');
    const b = await makeUser(app, 'rb');

    // video-only validation
    const badUrl = await authed(request(app).post('/api/v1/reels'), a.token)
      .send({ videoUrl: '/media/images/foo.png' });
    expect(badUrl.status).toBe(400);

    const r1 = await authed(request(app).post('/api/v1/reels'), a.token)
      .send({ videoUrl: '/media/videos/sample1.mp4', caption: 'first reel' });
    expect(r1.status).toBe(201);
    const r2 = await authed(request(app).post('/api/v1/reels'), a.token)
      .send({ videoUrl: '/media/videos/sample2.mp4' });
    expect(r2.status).toBe(201);

    // feed ordered newest first
    const feed = await authed(request(app).get('/api/v1/reels'), b.token);
    expect(feed.status).toBe(200);
    const ids = feed.body.reels.map((r: any) => r.id);
    expect(ids.indexOf(r2.body.reel.id)).toBeLessThan(ids.indexOf(r1.body.reel.id));
    expect(feed.body.reels[0].liked).toBe(false);
    expect(feed.body.reels[0].likes).toBe(0);

    // pagination
    const p1 = await authed(request(app).get('/api/v1/reels?limit=1'), b.token);
    expect(p1.body.reels.length).toBe(1);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await authed(request(app).get(`/api/v1/reels?limit=1&cursor=${p1.body.nextCursor}`), b.token);
    expect(p2.body.reels[0].id).not.toBe(p1.body.reels[0].id);

    // like toggle
    const like = await authed(request(app).post(`/api/v1/reels/${r1.body.reel.id}/like`), b.token)
      .send({ liked: true });
    expect(like.body).toEqual({ likes: 1, liked: true });
    const unlike = await authed(request(app).post(`/api/v1/reels/${r1.body.reel.id}/like`), b.token)
      .send({ liked: false });
    expect(unlike.body).toEqual({ likes: 0, liked: false });

    // views
    const view = await authed(request(app).post(`/api/v1/reels/${r1.body.reel.id}/view`), b.token);
    expect(view.body.views).toBe(1);

    // delete permissions
    const delB = await authed(request(app).delete(`/api/v1/reels/${r1.body.reel.id}`), b.token);
    expect(delB.status).toBe(403);
    const delA = await authed(request(app).delete(`/api/v1/reels/${r1.body.reel.id}`), a.token);
    expect(delA.status).toBe(200);
    const after = await authed(request(app).get('/api/v1/reels'), b.token);
    expect(after.body.reels.some((r: any) => r.id === r1.body.reel.id)).toBe(false);
  });
});
