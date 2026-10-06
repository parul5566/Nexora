import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createReel, listReels, likeReel, registerView, deleteReel } from './reelService.js';

const router = Router();

router.post('/reels', requireAuth, async (req: any, res, next) => {
  try {
    const reel = await createReel(req.ctx.userId, {
      videoUrl: String(req.body?.videoUrl ?? ''),
      caption: req.body?.caption ?? null,
    });
    res.status(201).json({ reel });
  } catch (e) { next(e); }
});

router.get('/reels', requireAuth, async (req: any, res, next) => {
  try {
    res.json(await listReels(req.ctx.userId, {
      cursor: (req.query.cursor as string) || null,
      limit: Number(req.query.limit) || 10,
    }));
  } catch (e) { next(e); }
});

router.post('/reels/:id/like', requireAuth, async (req: any, res, next) => {
  try {
    const on = req.body?.liked !== false;
    res.json(await likeReel(req.ctx.userId, Number(req.params.id), on));
  } catch (e) { next(e); }
});

router.post('/reels/:id/view', requireAuth, async (req: any, res, next) => {
  try {
    const seconds = Number(req.body?.seconds ?? 0);
    res.json({ views: await registerView(Number(req.params.id), req.ctx.userId, seconds) });
  } catch (e) { next(e); }
});

router.delete('/reels/:id', requireAuth, async (req: any, res, next) => {
  try {
    await deleteReel(req.ctx.userId, Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
