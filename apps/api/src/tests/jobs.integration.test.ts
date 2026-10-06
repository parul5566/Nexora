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
  const u = `jb${unique()}`.slice(0, 30);
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

describe('jobs (Module 17)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('recruiter posts, search+filters, apply once, applicants, status notify, save jobs', async () => {
    const a = await makeUser('a');   // company admin
    const b = await makeUser('b');   // recruiter
    const c = await makeUser('c');   // applicant
    const d = await makeUser('d');   // outsider

    const company = await authed(request(app).post('/api/v1/companies'), a.token)
      .send({ name: `JobCo ${unique()}` });
    const slug = company.body.company.slug;

    // Outsider cannot create jobs
    const dJob = await authed(request(app).post(`/api/v1/companies/${slug}/jobs`), d.token)
      .send({ title: 'X', description: 'Y' });
    expect(dJob.status).toBe(403);

    // Admin adds B as recruiter; recruiter CAN create jobs
    await authed(request(app).post(`/api/v1/companies/${slug}/admins`), a.token)
      .send({ username: b.username, role: 'recruiter' });
    const job = await authed(request(app).post(`/api/v1/companies/${slug}/jobs`), b.token)
      .send({ title: 'Senior TypeScript Engineer', description: 'Build APIs', location: 'Berlin', type: 'full-time', remote: true });
    expect(job.status).toBe(201);
    const jobId = job.body.job.id;
    const job2 = await authed(request(app).post(`/api/v1/companies/${slug}/jobs`), b.token)
      .send({ title: 'Intern', description: 'Learn', location: 'Remote', type: 'internship' });
    expect(job2.status).toBe(201);

    // Search + filters
    const byTitle = await authed(request(app).get('/api/v1/jobs?q=TypeScript'), c.token);
    expect(byTitle.body.jobs.some((j: any) => j.id === jobId)).toBe(true);
    const byType = await authed(request(app).get('/api/v1/jobs?type=internship'), c.token);
    expect(byType.body.jobs.every((j: any) => j.type === 'internship')).toBe(true);
    expect(byType.body.jobs.length).toBeGreaterThan(0);
    const byLoc = await authed(request(app).get('/api/v1/jobs?location=Berlin'), c.token);
    expect(byLoc.body.jobs.some((j: any) => j.id === jobId)).toBe(true);
    const byRemote = await authed(request(app).get('/api/v1/jobs?remote=1'), c.token);
    expect(byRemote.body.jobs.some((j: any) => j.id === jobId)).toBe(true);

    // Apply once
    const apply = await authed(request(app).post(`/api/v1/jobs/${jobId}/apply`), c.token)
      .send({ coverLetter: 'I love rockets' });
    expect(apply.status).toBe(200);
    const again = await authed(request(app).post(`/api/v1/jobs/${jobId}/apply`), c.token)
      .send({ coverLetter: 'again' });
    expect(again.status).toBe(409);

    // Employer sees applicant with profile link
    const applicants = await authed(request(app).get(`/api/v1/jobs/${jobId}/applicants`), b.token);
    expect(applicants.status).toBe(200);
    expect(applicants.body.applicants).toHaveLength(1);
    expect(applicants.body.applicants[0].profileUrl).toBe(`/u/${c.username}`);
    expect(applicants.body.applicants[0].status).toBe('applied');

    // Applicant cannot view applicants
    const cApplicants = await authed(request(app).get(`/api/v1/jobs/${jobId}/applicants`), c.token);
    expect(cApplicants.status).toBe(403);

    // Status update notifies applicant
    const appId = applicants.body.applicants[0].id;
    const viewed = await authed(request(app).patch(`/api/v1/applications/${appId}/status`), b.token)
      .send({ status: 'viewed' });
    expect(viewed.status).toBe(200);
    const hired = await authed(request(app).patch(`/api/v1/applications/${appId}/status`), b.token)
      .send({ status: 'hired' });
    expect(hired.status).toBe(200);
    const notifs = await authed(request(app).get('/api/v1/notifications'), c.token);
    const statuses = (notifs.body.notifications ?? []).filter((n: any) => n.type === 'mention' && n.payload?.applicationStatus);
    expect(statuses.length).toBeGreaterThanOrEqual(1);

    // Applicant sees own application status
    const myApps = await authed(request(app).get('/api/v1/jobs/applications'), c.token);
    expect(myApps.body.applications.some((ap: any) => ap.jobId === Number(jobId) && ap.status === 'hired')).toBe(true);

    // Saved jobs
    const save = await authed(request(app).post(`/api/v1/jobs/${jobId}/save`), d.token).send();
    expect(save.body.saved).toBe(true);
    const savedList = await authed(request(app).get('/api/v1/jobs/saved'), d.token);
    expect(savedList.body.jobs.some((j: any) => j.id === jobId)).toBe(true);
    const unsave = await authed(request(app).post(`/api/v1/jobs/${jobId}/save`), d.token).send({ saved: false });
    expect(unsave.body.saved).toBe(false);
    const savedAfter = await authed(request(app).get('/api/v1/jobs/saved'), d.token);
    expect(savedAfter.body.jobs.some((j: any) => j.id === jobId)).toBe(false);
  }, 30000);
});
