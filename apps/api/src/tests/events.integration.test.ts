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
  const u = `ev${unique()}`.slice(0, 30);
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

describe('events (Module 18)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('create, RSVP lifecycle, private gating, link gating, discussion, reminder', async () => {
    const a = await makeUser('a');
    const b = await makeUser('b');
    const c = await makeUser('c');

    const soon = new Date(Date.now() + 23 * 3600 * 1000).toISOString();
    const ev = await authed(request(app).post('/api/v1/events'), a.token)
      .send({ title: `Launch Party ${unique()}`, description: 'celebrate', startsAt: soon, onlineUrl: 'https://meet.example/x', showLinkToRsvpsOnly: true });
    expect(ev.status).toBe(201);
    const eventId = ev.body.event.id;

    // link hidden before RSVP
    const bView = await authed(request(app).get(`/api/v1/events/${eventId}`), b.token);
    expect(bView.status).toBe(200);
    expect(bView.body.event.onlineUrl).toBeNull();

    // RSVP going → link visible; change RSVP works
    const rsvp = await authed(request(app).post(`/api/v1/events/${eventId}/rsvp`), b.token).send({ status: 'going' });
    expect(rsvp.status).toBe(200);
    expect(rsvp.body.event.going).toBe(1);
    const bView2 = await authed(request(app).get(`/api/v1/events/${eventId}`), b.token);
    expect(bView2.body.event.onlineUrl).toBe('https://meet.example/x');
    const rsvp2 = await authed(request(app).post(`/api/v1/events/${eventId}/rsvp`), b.token).send({ status: 'interested' });
    expect(rsvp2.body.event.myRsvp).toBe('interested');
    expect(rsvp2.body.event.interested).toBe(1);
    expect(rsvp2.body.event.going).toBe(0);

    // attendees list
    await authed(request(app).post(`/api/v1/events/${eventId}/rsvp`), b.token).send({ status: 'going' });
    const attendees = await authed(request(app).get(`/api/v1/events/${eventId}/attendees`), a.token);
    expect(attendees.body.attendees).toHaveLength(1);
    expect(attendees.body.attendees[0].username).toBe(b.username);

    // discussion: attendee can post, outsider C can read (public event) but that's fine
    const comment = await authed(request(app).post(`/api/v1/events/${eventId}/comments`), b.token)
      .send({ text: 'see you there' });
    expect(comment.status).toBe(200);
    const comments = await authed(request(app).get(`/api/v1/events/${eventId}/comments`), c.token);
    expect(comments.body.comments).toHaveLength(1);

    // private event: non-invitee blocked, invitee ok
    const priv = await authed(request(app).post('/api/v1/events'), a.token)
      .send({ title: `Secret ${unique()}`, startsAt: soon, privacy: 'private' });
    const privId = priv.body.event.id;
    const cBlocked = await authed(request(app).get(`/api/v1/events/${privId}`), c.token);
    expect(cBlocked.status).toBe(403);
    await authed(request(app).post(`/api/v1/events/${privId}/invite`), a.token).send({ username: b.username });
    const bAllowed = await authed(request(app).get(`/api/v1/events/${privId}`), b.token);
    expect(bAllowed.status).toBe(200);

    // listing excludes private events for C
    const list = await authed(request(app).get('/api/v1/events'), c.token);
    expect(list.body.events.some((e: any) => e.id === privId)).toBe(false);
    const listB = await authed(request(app).get('/api/v1/events'), b.token);
    expect(listB.body.events.some((e: any) => e.id === privId)).toBe(true);

    // reminders: event starts within 24h → reminder fires to going attendees
    const fired = await svc_processReminders();
    expect(fired).toBeGreaterThanOrEqual(1);
    const notifs = await authed(request(app).get('/api/v1/notifications'), b.token);
    const reminders = (notifs.body.notifications ?? []).filter((n: any) => n.payload?.eventId === String(eventId) || n.payload?.eventId === eventId);
    expect(reminders.length).toBeGreaterThanOrEqual(1);

    // second run doesn't re-fire (reminded_at set)
    const fired2 = await svc_processReminders();
    const reminders2 = (notifs.body.notifications ?? []).filter((n: any) => n.payload?.eventId === String(eventId));
    expect(fired2).toBe(0);
  }, 30000);
});

async function svc_processReminders(): Promise<number> {
  const { processReminders } = await import('../events/eventService.js');
  return processReminders();
}
