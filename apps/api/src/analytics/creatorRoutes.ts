import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCreatorDashboard, getPostAnalytics, getReelAnalytics, type Range } from './creatorService.js';

const router = Router();
router.use(requireAuth);

const RANGES = new Set(['7d', '30d', '90d', 'all']);

// GET /analytics/creator?range=7d|30d|90d|all
router.get('/analytics/creator', async (req: any, res, next) => {
  try {
    const range = (String(req.query.range || '30d') as Range);
    res.json(await getCreatorDashboard(req.ctx.userId, RANGES.has(range) ? range : '30d'));
  } catch (e) { next(e); }
});

// GET /analytics/posts/:id — owner only
router.get('/analytics/posts/:id', async (req: any, res, next) => {
  try {
    res.json(await getPostAnalytics(Number(req.params.id), req.ctx.userId));
  } catch (e) { next(e); }
});

// GET /analytics/reels/:id — owner only
router.get('/analytics/reels/:id', async (req: any, res, next) => {
  try {
    res.json(await getReelAnalytics(Number(req.params.id), req.ctx.userId));
  } catch (e) { next(e); }
});

export default router;
