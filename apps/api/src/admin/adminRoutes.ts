import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest } from '@nexora/shared';
import {
  adminEditContent, getAdminTier, listContent, platformAnalytics,
  requireCapability, searchUsers, setUserStatus,
} from './adminService.js';
import { listAuditTrail, listReports } from '../moderation/moderationService.js';

const router = Router();
router.use(requireAuth);

// Admin gate: everything under /admin requires at least one admin role.
router.use('/admin', async (req: any, res, next) => {
  try {
    const tier = await getAdminTier(req.ctx.userId);
    if (!tier) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    next();
  } catch (e) { next(e); }
});

router.get('/admin/me', async (req: any, res) => {
  res.json({ tier: await getAdminTier(req.ctx.userId) });
});

router.get('/admin/users', async (req: any, res, next) => {
  try {
    await requireCapability(req.ctx.userId, 'manage_users');
    res.json({ users: await searchUsers(String(req.query.q ?? '')) });
  } catch (e) { next(e); }
});

router.post('/admin/users/:id/status', async (req: any, res, next) => {
  try {
    const status = req.body?.status;
    if (!['active', 'restricted', 'suspended', 'banned'].includes(status)) throw badRequest('Invalid status');
    res.json(await setUserStatus(req.ctx.userId, Number(req.params.id), status));
  } catch (e) { next(e); }
});

router.get('/admin/content/:type', async (req: any, res, next) => {
  try {
    const type = String(req.params.type);
    if (!['post', 'reel', 'comment'].includes(type)) throw badRequest('Invalid content type');
    res.json({ items: await listContent(type as any) });
  } catch (e) { next(e); }
});

router.post('/admin/content/:type/:id', async (req: any, res, next) => {
  try {
    const type = String(req.params.type);
    if (!['post', 'reel', 'comment'].includes(type)) throw badRequest('Invalid content type');
    const action = req.body?.action;
    if (!['remove', 'restore', 'edit'].includes(action)) throw badRequest('Invalid action');
    res.json(await adminEditContent(req.ctx.userId, type as any, Number(req.params.id), action, req.body?.text));
  } catch (e) { next(e); }
});

router.get('/admin/reports', async (req: any, res, next) => {
  try {
    await requireCapability(req.ctx.userId, 'view_reports');
    const status = ['open', 'resolved', 'dismissed', 'all'].includes(String(req.query.status)) ? String(req.query.status) as any : 'all';
    res.json({ reports: await listReports(status) });
  } catch (e) { next(e); }
});

router.get('/admin/analytics', async (req: any, res, next) => {
  try {
    await requireCapability(req.ctx.userId, 'view_analytics');
    res.json(await platformAnalytics());
  } catch (e) { next(e); }
});

router.get('/admin/audit', async (req: any, res, next) => {
  try {
    await requireCapability(req.ctx.userId, 'view_reports');
    res.json({ actions: await listAuditTrail() });
  } catch (e) { next(e); }
});

export default router;
