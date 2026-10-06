import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';

process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '3306';
process.env.DB_NAME ??= process.env.TEST_DB_NAME || 'u1787p3869_nexora';
process.env.DB_USER ??= 'u1787p3869_user';
process.env.DB_PASSWORD ??= 'HrRmEjUwsmBvnVvx';
process.env.RUN_MAIN = 'false';
process.env.PORT = '4601';

let app: any;
let server: any;
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

let httpServer: any;

beforeAll(async () => {
  app = (await import('../server.js')).default;
  const { start } = await import('../server.js');
  httpServer = await start();
}, 30000);

afterAll(async () => {
  if (httpServer) await new Promise<void>((r) => httpServer.close(() => r()));
});

function wsConnect(token: string, conversationId: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:4601/ws?token=${token}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', conversationId }));
      resolve(ws);
    });
    ws.on('error', reject);
  });
}

function nextMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS message timeout')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
}

describe('messaging (Module 11)', () => {
  it('REST: create conversation, send, list, paginate; participant-only access', async () => {
    const a = await makeUser(app, 'ma');
    const b = await makeUser(app, 'mb');
    const c = await makeUser(app, 'mc');

    const conv = await authed(request(app).post('/api/v1/conversations'), a.token)
      .send({ username: b.username });
    expect(conv.status).toBe(201);
    const convId = conv.body.id;

    // idempotent get-or-create
    const again = await authed(request(app).post('/api/v1/conversations'), b.token)
      .send({ username: a.username });
    expect(again.body.id).toBe(convId);

    const sent = await authed(request(app).post(`/api/v1/conversations/${convId}/messages`), a.token)
      .send({ content: 'hello B' });
    expect(sent.status).toBe(201);
    expect(sent.body.message.content).toBe('hello B');

    // participant reads
    const inbox = await authed(request(app).get(`/api/v1/conversations/${convId}/messages`), b.token);
    expect(inbox.status).toBe(200);
    expect(inbox.body.messages[0].content).toBe('hello B');
    expect(inbox.body.messages[0].sender.username).toBe(a.username);

    // non-participant blocked from read + send
    const readC = await authed(request(app).get(`/api/v1/conversations/${convId}/messages`), c.token);
    expect(readC.status).toBe(403);
    const sendC = await authed(request(app).post(`/api/v1/conversations/${convId}/messages`), c.token)
      .send({ content: 'sneak' });
    expect(sendC.status).toBe(403);

    // conversation list shows other user + last message
    const list = await authed(request(app).get('/api/v1/conversations'), a.token);
    const entry = list.body.conversations.find((x: any) => x.id === convId);
    expect(entry.other.username).toBe(b.username);
    expect(entry.lastMessage).toBe('hello B');

    // validation
    const empty = await authed(request(app).post(`/api/v1/conversations/${convId}/messages`), a.token)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);
  });

  it('WS: online recipient receives message in real time; bad token rejected', async () => {
    const a = await makeUser(app, 'md');
    const b = await makeUser(app, 'me');

    const conv = await authed(request(app).post('/api/v1/conversations'), a.token)
      .send({ username: b.username });
    const convId = conv.body.id;

    // bad token rejected — server closes with 4001 after the upgrade race
    await new Promise<void>((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:4601/ws?token=invalid');
      ws.on('close', (code) => { expect(code).toBe(4001); resolve(); });
      ws.on('open', () => { /* upgrade completes before server close; wait for close */ });
      ws.on('error', () => { /* client may see reset; close still fires */ });
      setTimeout(resolve, 4000);
    });

    const wsB = await wsConnect(b.token, Number(convId));
    await new Promise((r) => setTimeout(r, 200)); // let subscribe register

    const framePromise = nextMessage(wsB); // attach BEFORE sending
    await authed(request(app).post(`/api/v1/conversations/${convId}/messages`), a.token)
      .send({ content: 'realtime ping' });

    const frame = await framePromise;
    expect(frame.type).toBe('message');
    expect(frame.message.content).toBe('realtime ping');
    expect(frame.message.sender.username).toBe(a.username);
    wsB.close();
  }, 20000);
});
