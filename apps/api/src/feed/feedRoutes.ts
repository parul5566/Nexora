import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { homeFeed } from './feedService.js';

const router = Router();

router.get('/feed', requireAuth, async (req: any, res, next) => {
  try {
    const result = await homeFeed(req.ctx.userId, {
      cursor: (req.query.cursor as string) || null,
      limit: Number(req.query.limit) || 20,
      discover: req.query.discover === '1' || req.query.discover === 'true',
    });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
