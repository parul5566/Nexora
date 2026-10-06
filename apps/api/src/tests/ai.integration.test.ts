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

describe('AI services (Module 22)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('features work through the provider interface; unavailable degrades gracefully', async () => {
    const user = await makeUser(app, 'ai');

    // status endpoint reflects availability
    const status = await authed(request(app).get('/api/v1/ai/status'), user.token).expect(200);
    expect(typeof status.body.available).toBe('boolean');

    // Unknown feature 404s
    await authed(request(app).post('/api/v1/ai/nonsense').send({ input: 'x' }), user.token).expect(404);

    // Auth required
    await request(app).post('/api/v1/ai/write').send({ input: 'x' }).expect(401);

    if (status.body.available) {
      // Provider configured: real feature call
      const res = await authed(request(app).post('/api/v1/ai/write'))
        .send({ input: 'this sentense have error' })
        .set('Authorization', `Bearer ${user.token}`);
      expect([200, 503]).toContain(res.status); // 503 only if upstream fails
      if (res.status === 200) {
        expect(res.body.available).toBe(true);
        expect(typeof res.body.result).toBe('string');
        expect(res.body.result.length).toBeGreaterThan(0);
      } else {
        expect(res.body.available).toBe(false);
      }
    } else {
      // No provider configured: graceful, honest unavailable state
      const res = await authed(request(app).post('/api/v1/ai/write'))
        .send({ input: 'hello' })
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(503);
      expect(res.body.available).toBe(false);
      expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    }

    // Empty input rejected
    await authed(request(app).post('/api/v1/ai/write').send({ input: '  ' }), user.token).expect(400);
  }, 60000);

  it('unit: StaticProvider via AiService (no network) and unavailable error path', async () => {
    const { AiService } = await import('../ai/aiService.js');
    const { StaticProvider, OpenAICompatibleProvider, AiUnavailableError } = await import('../ai/aiProvider.js');

    // Provider-agnostic: swapping providers needs no caller changes
    const withStatic = new AiService(new StaticProvider((p) => `echo:${p.slice(0, 10)}`));
    const out = await withStatic.run('write', 'hello world');
    expect(out.available).toBe(true);
    expect(out.result.startsWith('echo:')).toBe(true);

    // Unconfigured provider degrades with a typed error
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const dry = new AiService(new OpenAICompatibleProvider({ apiKey: undefined }));
      expect(dry.available).toBe(false);
      await expect(dry.run('write', 'hello')).rejects.toBeInstanceOf(AiUnavailableError);
    } finally {
      process.env.OPENAI_API_KEY = savedKey;
    }
  });
});
