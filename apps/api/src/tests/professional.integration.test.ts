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
  const u = `pp${unique()}`.slice(0, 30);
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

describe('professional profiles (Module 15)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('section CRUD in dated order, recommendations flow, professional mode', async () => {
    const a = await makeUser('a');
    const b = await makeUser('b');
    const c = await makeUser('c');

    // Experience CRUD
    const exp1 = await authed(request(app).post('/api/v1/professional/experiences'), a.token)
      .send({ title: 'Junior Dev', company: 'Acme', start_ym: '2020-01', end_ym: '2022-05' });
    expect(exp1.status).toBe(201);
    const exp2 = await authed(request(app).post('/api/v1/professional/experiences'), a.token)
      .send({ title: 'Senior Dev', company: 'Globex', start_ym: '2022-06', current: true });
    expect(exp2.status).toBe(201);

    const expList = await authed(request(app).get('/api/v1/professional/experiences'), a.token);
    expect(expList.status).toBe(200);
    expect(expList.body.entries).toHaveLength(2);
    // current role first, then most recent
    expect(expList.body.entries[0].title).toBe('Senior Dev');
    expect(expList.body.entries[1].title).toBe('Junior Dev');

    const editExp = await authed(request(app).patch(`/api/v1/professional/experiences/${exp1.body.entry.id}`), a.token)
      .send({ title: 'Mid Dev' });
    expect(editExp.status).toBe(200);
    const delExp = await authed(request(app).delete(`/api/v1/professional/experiences/${exp1.body.entry.id}`), a.token);
    expect(delExp.status).toBe(200);
    const afterDel = await authed(request(app).get('/api/v1/professional/experiences'), a.token);
    expect(afterDel.body.entries).toHaveLength(1);

    // Other sections
    const edu = await authed(request(app).post('/api/v1/professional/education'), a.token)
      .send({ school: 'MIT', degree: 'BSc', field_of_study: 'CS', start_ym: '2016-09', end_ym: '2020-06' });
    expect(edu.status).toBe(201);
    const skill = await authed(request(app).post('/api/v1/professional/skills'), a.token).send({ name: 'TypeScript' });
    expect(skill.status).toBe(201);
    const cert = await authed(request(app).post('/api/v1/professional/certifications'), a.token)
      .send({ name: 'AWS SA', issuer: 'Amazon', issue_ym: '2023-03' });
    expect(cert.status).toBe(201);
    const proj = await authed(request(app).post('/api/v1/professional/projects'), a.token)
      .send({ name: 'Nexora', description: 'social platform', url: 'https://example.com' });
    expect(proj.status).toBe(201);

    // Recommendations: non-connection blocked
    const recBlocked = await authed(request(app).post('/api/v1/professional/recommendations'), c.token)
      .send({ username: b.username, text: 'great dev' });
    if (recBlocked.status!==403) console.log('RECBLOCKED', recBlocked.status, JSON.stringify(recBlocked.body));
    expect(recBlocked.status).toBe(403);

    // A ↔ B connect
    await authed(request(app).post(`/api/v1/follows/${b.username}`), a.token).send();
    const reqConn = await authed(request(app).post(`/api/v1/connections/${b.username}/request`), a.token).send();
    expect(reqConn.status).toBe(200);
    const acceptConn = await authed(request(app).post(`/api/v1/connections/${a.username}/accept`), b.token).send();
    expect(acceptConn.status).toBe(200);

    // Connected recommendation → pending → accepted
    const rec = await authed(request(app).post('/api/v1/professional/recommendations'), a.token)
      .send({ username: b.username, text: 'Outstanding engineer', relationship: 'colleague' });
    expect(rec.status).toBe(200);
    expect(rec.body.status).toBe('pending');

    const pending = await authed(request(app).get('/api/v1/professional/recommendations/pending'), b.token);
    expect(pending.body.recommendations).toHaveLength(1);

    const publicBefore = await request(app).get(`/api/v1/users/${b.username}/professional`);
    if (publicBefore.body.recommendations===undefined) console.log('PUBBEFORE', publicBefore.status, JSON.stringify(publicBefore.body).slice(0,200));
    expect(publicBefore.body.recommendations).toHaveLength(0); // hidden until accepted

    const respond = await authed(request(app).post(`/api/v1/professional/recommendations/${a.username}/respond`), b.token)
      .send({ accept: true });
    if (respond.status!==200) console.log('RESPOND', respond.status, JSON.stringify(respond.body));
    expect(respond.status).toBe(200);

    const publicAfter = await request(app).get(`/api/v1/users/${b.username}/professional`);
    if (publicAfter.status!==200||publicAfter.body.recommendations?.length!==1) console.log('PUBAFTER', publicAfter.status, JSON.stringify(publicAfter.body).slice(0,300));
    expect(publicAfter.body.recommendations).toHaveLength(1);
    expect(publicAfter.body.recommendations[0].text).toBe('Outstanding engineer');

    // Professional mode toggle
    const mode = await authed(request(app).post('/api/v1/professional/mode'), b.token)
      .send({ enabled: true, headline: 'Full-stack engineer', industry: 'Software' });
    if (mode.status!==200) console.log('MODE', mode.status, JSON.stringify(mode.body));
    expect(mode.status).toBe(200);
    const prof = await request(app).get(`/api/v1/users/${b.username}/professional`);
    if (prof.body.professionalMode!==true) console.log('PROF', prof.status, JSON.stringify(prof.body).slice(0,300));
    expect(prof.body.professionalMode).toBe(true);
    expect(prof.body.headline).toBe('Full-stack engineer');
  }, 30000);
});
