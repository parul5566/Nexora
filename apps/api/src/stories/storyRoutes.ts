import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createStory, storyFeed, listUserStories, markViewed, storyViewers, deleteStory } from './storyService.js';

const router = Router();

router.post('/stories', requireAuth, async (req: any, res, next) => {
  try {
    const story = await createStory(req.ctx.userId, {
      mediaUrl: req.body?.mediaUrl ?? null,
      mediaType: req.body?.mediaType ?? null,
      bgText: req.body?.bgText ?? null,
      bgColor: req.body?.bgColor,
    });
    res.status(201).json({ story });
  } catch (e) { next(e); }
});

router.get('/stories/feed', requireAuth, async (req: any, res, next) => {
  try {
    res.json({ groups: await storyFeed(req.ctx.userId) });
  } catch (e) { next(e); }
});

router.get('/stories/user/:username', requireAuth, async (req: any, res, next) => {
  try {
    const group = await listUserStories(req.ctx.userId, req.params.username);
    res.json({ group });
  } catch (e) { next(e); }
});

router.post('/stories/:id/view', requireAuth, async (req: any, res, next) => {
  try {
    await markViewed(req.ctx.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/stories/:id/viewers', requireAuth, async (req: any, res, next) => {
  try {
    res.json({ viewers: await storyViewers(req.ctx.userId, Number(req.params.id)) });
  } catch (e) { next(e); }
});

router.delete('/stories/:id', requireAuth, async (req: any, res, next) => {
  try {
    await deleteStory(req.ctx.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
