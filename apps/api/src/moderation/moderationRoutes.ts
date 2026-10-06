import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest } from '@nexora/shared';
import {
  act, createReport, listAuditTrail, listReports, requireAdmin, requireModerator, restoreObject,
  type ModAction, type ObjectType,
} from './moderationService.js';

const router = Router();
router.use(requireAuth);

const OBJECT_TYPES = new Set<ObjectType>(['post', 'comment', 'user', 'community', 'job', 'message', 'reel', 'story']);
const ACTIONS = new Set<ModAction>(['remove_content', 'restore_content', 'warn', 'restrict', 'suspend', 'ban', 'unban', 'dismiss']);

// Any authenticated user can report
router.post('/reports', async (req: any, res, next) => {
  try {
    const { objectType, objectId, reason } = req.body ?? {};
    if (!OBJECT_TYPES.has(objectType)) throw badRequest('Invalid objectType');
    const id = Number(objectId);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid objectId');
    res.status(201).json(await createReport(req.ctx.userId, objectType, id, String(reason ?? '')));
  } catch (e) { next(e); }
});

// Everything below is moderator-only
router.use('/moderation', async (req: any, _res, next) => {
  try { await requireModerator(req.ctx.userId); next(); } catch (e) { next(e); }
});

router.get('/moderation/reports', async (req: any, res, next) => {
  try {
    const status = ['open', 'resolved', 'dismissed', 'all'].includes(String(req.query.status)) ? String(req.query.status) as any : 'open';
    res.json({ reports: await listReports(status) });
  } catch (e) { next(e); }
});

router.post('/moderation/reports/:id/act', async (req: any, res, next) => {
  try {
    const action = req.body?.action;
    if (!ACTIONS.has(action)) throw badRequest('Invalid action');
    res.json(await act(req.ctx.userId, Number(req.params.id), action, req.body?.note));
  } catch (e) { next(e); }
});

router.post('/moderation/restore', async (req: any, res, next) => {
  try {
    const { objectType, objectId } = req.body ?? {};
    if (!['post', 'comment', 'reel', 'story'].includes(objectType)) throw badRequest('Invalid objectType');
    res.json(await restoreObject(req.ctx.userId, objectType, Number(objectId), req.body?.note));
  } catch (e) { next(e); }
});

router.get('/moderation/audit', async (req: any, res, next) => {
  try {
    res.json({ actions: await listAuditTrail() });
  } catch (e) { next(e); }
});

export default router;
