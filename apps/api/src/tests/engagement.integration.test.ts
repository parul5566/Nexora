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

async function makePost(app: any, token: string, content: string) {
  const res = await authed(request(app).post('/api/v1/posts'), token).send({ content });
  expect(res.status).toBe(201);
  return Number(res.body.post.id);
}

describe('reactions + comments (Module 07)', () => {
  beforeAll(async () => {
    app = (await import('../server.js')).default;
  });

  it('six reaction types set/change/clear; summary reflects counts', async () => {
    const a = await makeUser(app, 'ra');
    const b = await makeUser(app, 'rb');
    const postId = await makePost(app, a.token, 'react to me');

    const set = await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token)
      .send({ type: 'love' });
    expect(set.status).toBe(200);
    expect(set.body.reactions.total).toBe(1);
    expect(set.body.reactions.myReaction).toBe('love');

    // change type — no duplicate row
    const change = await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token)
      .send({ type: 'haha' });
    expect(change.body.reactions.myReaction).toBe('haha');
    expect(change.body.reactions.total).toBe(1);

    const c = await makeUser(app, 'rc');
    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), c.token).send({ type: 'angry' });
    const author = await authed(request(app).get(`/api/v1/posts/${postId}`), a.token);
    expect(author.body.post.reactions.total).toBe(2);
    expect(author.body.post.reactions.counts.haha).toBe(1);
    expect(author.body.post.reactions.counts.angry).toBe(1);
    expect(author.body.post.reactions.myReaction).toBeNull(); // author didn't react

    // invalid type rejected
    const bad = await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), a.token)
      .send({ type: 'meh' });
    expect(bad.status).toBe(400);

    // clear
    const clear = await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token)
      .send({ type: 'none' });
    expect(clear.body.reactions.total).toBe(1);
    expect(clear.body.reactions.myReaction).toBeNull();
  });

  it('requires auth to react', async () => {
    const a = await makeUser(app, 'rd');
    const postId = await makePost(app, a.token, 'no anon');
    const res = await request(app).post(`/api/v1/posts/${postId}/reactions`).send({ type: 'like' });
    expect(res.status).toBe(401);
  });

  it('comments: add, edit (edited flag), nested reply 2 levels, list order, delete perms', async () => {
    const a = await makeUser(app, 're');
    const b = await makeUser(app, 'rf');
    const postId = await makePost(app, a.token, 'comment here');

    const c1 = await authed(request(app).post(`/api/v1/posts/${postId}/comments`), b.token)
      .send({ content: 'first comment' });
    expect(c1.status).toBe(201);
    const c1Id = c1.body.comment.id;

    const reply = await authed(request(app).post(`/api/v1/posts/${postId}/comments`), a.token)
      .send({ content: 'a reply', parentId: c1Id });
    expect(reply.status).toBe(201);
    expect(reply.body.comment.parentId).toBe(c1Id);

    // reply-to-reply folds into level 2 (2-level threads)
    const reply2 = await authed(request(app).post(`/api/v1/posts/${postId}/comments`), b.token)
      .send({ content: 'reply to reply', parentId: reply.body.comment.id });
    expect(reply2.body.comment.parentId).toBe(c1Id);

    // edit own comment
    const edit = await authed(request(app).patch(`/api/v1/comments/${c1Id}`), b.token)
      .send({ content: 'first comment (edited)' });
    expect(edit.status).toBe(200);
    expect(edit.body.comment.edited).toBe(true);

    // b cannot edit a's comment
    const editOther = await authed(request(app).patch(`/api/v1/comments/${reply.body.comment.id}`), b.token)
      .send({ content: 'hijack' });
    expect(editOther.status).toBe(404);

    // list: top level shows c1 with replies nested
    const list = await authed(request(app).get(`/api/v1/posts/${postId}/comments`), a.token);
    expect(list.status).toBe(200);
    const top = list.body.comments.find((x: any) => x.id === c1Id);
    expect(top.content).toBe('first comment (edited)');
    expect(top.replies.length).toBe(2);
    expect(top.reactions.total).toBe(0);

    // comment author deletes own; post author can delete others' comments on their post
    const del = await authed(request(app).delete(`/api/v1/comments/${c1Id}`), a.token);
    expect(del.status).toBe(200); // a is the post author
    const listAfter = await authed(request(app).get(`/api/v1/posts/${postId}/comments`), a.token);
    expect(listAfter.body.comments.find((x: any) => x.id === c1Id)).toBeUndefined();

    // non-author non-post-author cannot delete
    const e = await makeUser(app, 'rg');
    const c2 = await authed(request(app).post(`/api/v1/posts/${postId}/comments`), b.token)
      .send({ content: 'stays' });
    const delForeign = await authed(request(app).delete(`/api/v1/comments/${c2.body.comment.id}`), e.token);
    expect(delForeign.status).toBe(403);
  });

  it('comment reactions work and require auth', async () => {
    const a = await makeUser(app, 'rh');
    const b = await makeUser(app, 'ri');
    const postId = await makePost(app, a.token, 'comment reactions');
    const c = await authed(request(app).post(`/api/v1/posts/${postId}/comments`), a.token)
      .send({ content: 'like this comment' });

    const anon = await request(app).post(`/api/v1/comments/${c.body.comment.id}/reactions`).send({ type: 'like' });
    expect(anon.status).toBe(401);

    const rx = await authed(request(app).post(`/api/v1/comments/${c.body.comment.id}/reactions`), b.token)
      .send({ type: 'like' });
    expect(rx.status).toBe(200);
    expect(rx.body.reactions).toEqual({ total: 1, myReaction: 'like' });
  });

  it('feed post carries reaction + comment aggregates', async () => {
    const a = await makeUser(app, 'rj');
    const b = await makeUser(app, 'rk');
    const postId = await makePost(app, a.token, 'aggregate me');
    await authed(request(app).post(`/api/v1/posts/${postId}/reactions`), b.token).send({ type: 'wow' });
    await authed(request(app).post(`/api/v1/posts/${postId}/comments`), b.token).send({ content: 'nice' });

    const feed = await authed(request(app).get(`/api/v1/users/${a.username}/posts`), b.token);
    const post = feed.body.items.find((p: any) => Number(p.id) === postId);
    expect(post.reactions.total).toBe(1);
    expect(post.reactions.myReaction).toBe('wow');
    expect(post.commentCount).toBe(1);
  });
});
