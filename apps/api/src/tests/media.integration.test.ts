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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

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

describe('media pipeline (Module 06)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('image upload → processed variants (thumb + resized) served with cache headers', async () => {
    const a = await makeUser(app, 'md');
    const up = await authed(request(app).post('/api/v1/media/upload'), a.token)
      .attach('file', PNG, 'tiny.png');
    expect(up.status).toBe(201);
    const media = up.body.media;
    expect(media.kind).toBe('image');
    expect(media.status).toBe('ready');
    expect(media.thumbUrl).toMatch(/-thumb\.webp$/);
    expect(media.resizedUrl).toMatch(/-w1200\.webp$/);

    for (const url of [media.url, media.thumbUrl, media.resizedUrl]) {
      const served = await request(app).get(url);
      expect(served.status).toBe(200);
      expect(served.headers['cache-control']).toContain('max-age');
    }

    // owner fetch metadata by id
    const meta = await authed(request(app).get(`/api/v1/media/${media.id}`), a.token);
    expect(meta.status).toBe(200);
    expect(meta.body.media.id).toBe(media.id);
  });

  it('metadata-only storage: no blobs in DB rows', async () => {
    const a = await makeUser(app, 'mb');
    const up = await authed(request(app).post('/api/v1/media/upload'), a.token).attach('file', PNG, 'x.png');
    const { pool } = await import('../db/database.js');
    const [rows]: any = await pool.query('SELECT * FROM media_objects WHERE id = ?', [up.body.media.id]);
    const row = rows[0];
    expect(row.storage_path.startsWith('/media/')).toBe(true);
    expect(JSON.stringify(row).length).toBeLessThan(2000); // metadata only
  });

  it('rejects disallowed MIME and oversized files', async () => {
    const a = await makeUser(app, 'mc');
    const bad = await authed(request(app).post('/api/v1/media/upload'), a.token)
      .attach('file', Buffer.from('MZ fake executable'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toContain('Unsupported file type');

    const big = await authed(request(app).post('/api/v1/media/upload'), a.token)
      .attach('file', Buffer.alloc(51 * 1024 * 1024, 0), { filename: 'big.png', contentType: 'image/png' });
    expect([400, 413]).toContain(big.status);
  });

  it('upload requires auth', async () => {
    const res = await request(app).post('/api/v1/media/upload').attach('file', PNG, 'a.png');
    expect(res.status).toBe(401);
  });

  it('image post flow uses processed media URL', async () => {
    const a = await makeUser(app, 'mf');
    const up = await authed(request(app).post('/api/v1/media/upload'), a.token).attach('file', PNG, 'p.png');
    const post = await authed(request(app).post('/api/v1/posts'), a.token)
      .send({ content: 'with image', mediaUrls: [{ url: up.body.media.resizedUrl, kind: 'image' }] });
    expect(post.status).toBe(201);
    expect(post.body.post.media[0].url).toBe(up.body.media.resizedUrl);
  });
});
