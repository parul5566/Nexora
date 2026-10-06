import { Router } from 'express';
import { requireSession } from '../auth/authService.js';
import * as svc from './eventService.js';
import { badRequest } from '@nexora/shared';

const router = Router();

const bearer = (req: any) =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req: any) => requireSession(bearer(req));

router.post('/events', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const event = await svc.createEvent(Number(ctx.userId), req.body ?? {});
    res.status(201).json({ event });
  } catch (e) { next(e); }
});

router.get('/events', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json(await svc.listEvents(Number(ctx.userId), {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    }));
  } catch (e) { next(e); }
});

router.get('/events/:id', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ event: await svc.getEvent(Number(req.params.id), Number(ctx.userId)) });
  } catch (e) { next(e); }
});

router.post('/events/:id/rsvp', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const status = req.body?.status;
    if (!['going', 'interested', 'not'].includes(status)) throw badRequest('Invalid RSVP status');
    res.json({ event: await svc.rsvp(Number(ctx.userId), Number(req.params.id), status) });
  } catch (e) { next(e); }
});

router.post('/events/:id/invite', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    if (!username) throw badRequest('username is required');
    res.json(await svc.invite(Number(ctx.userId), Number(req.params.id), username));
  } catch (e) { next(e); }
});

router.get('/events/:id/attendees', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ attendees: await svc.listAttendees(Number(ctx.userId), Number(req.params.id)) });
  } catch (e) { next(e); }
});

router.get('/events/:id/comments', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ comments: await svc.listComments(Number(ctx.userId), Number(req.params.id)) });
  } catch (e) { next(e); }
});

router.post('/events/:id/comments', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    res.json(await svc.addComment(Number(ctx.userId), Number(req.params.id), text));
  } catch (e) { next(e); }
});

export default router;
