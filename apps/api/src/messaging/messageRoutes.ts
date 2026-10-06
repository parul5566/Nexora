import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getOrCreateConversation, sendMessage, listMessages, listConversations } from './messageService.js';
import { deliverMessage } from './wsHub.js';
import { badRequest } from '@nexora/shared';

const router = Router();

router.get('/conversations', requireAuth, async (req: any, res, next) => {
  try {
    res.json({ conversations: await listConversations(req.ctx.userId) });
  } catch (e) { next(e); }
});

router.post('/conversations', requireAuth, async (req: any, res, next) => {
  try {
    const { username } = req.body ?? {};
    if (!username) throw badRequest('username is required');
    res.status(201).json(await getOrCreateConversation(req.ctx.userId, String(username)));
  } catch (e) { next(e); }
});

router.get('/conversations/:id/messages', requireAuth, async (req: any, res, next) => {
  try {
    res.json(await listMessages(req.ctx.userId, Number(req.params.id), {
      cursor: (req.query.cursor as string) || null,
      limit: Number(req.query.limit) || 30,
    }));
  } catch (e) { next(e); }
});

router.post('/conversations/:id/messages', requireAuth, async (req: any, res, next) => {
  try {
    const { content } = req.body ?? {};
    const message = await sendMessage(req.ctx.userId, Number(req.params.id), String(content ?? ''));
    deliverMessage(Number(req.params.id), message); // push to online participants
    res.status(201).json({ message });
  } catch (e) { next(e); }
});

export default router;
