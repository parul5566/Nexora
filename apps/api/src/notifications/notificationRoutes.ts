import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listNotifications, markRead, unreadCount } from './notificationService.js';
import { badRequest } from '@nexora/shared';

const router = Router();

router.get('/notifications', requireAuth, async (req: any, res, next) => {
  try {
    const result = await listNotifications(req.ctx.userId, {
      cursor: (req.query.cursor as string) || null,
      limit: Number(req.query.limit) || 20,
      type: (req.query.type as string) || null,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/notifications/unread-count', requireAuth, async (req: any, res, next) => {
  try {
    res.json({ unread: await unreadCount(req.ctx.userId) });
  } catch (e) { next(e); }
});

router.post('/notifications/read', requireAuth, async (req: any, res, next) => {
  try {
    const { ids, all } = req.body ?? {};
    if (all !== true && !Array.isArray(ids)) throw badRequest('Provide ids: string[] or all: true');
    const updated = await markRead(req.ctx.userId, all === true ? null : ids.map(String));
    res.json({ updated });
  } catch (e) { next(e); }
});

export default router;
