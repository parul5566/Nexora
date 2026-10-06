import { Router } from 'express';
import { requireSession } from '../auth/authService.js';
import * as svc from './communityService.js';
import { pinPost, moderatePost } from './communityModeration.js';
import { badRequest } from '@nexora/shared';

const router = Router();

const bearer = (req: any) =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req: any) => requireSession(bearer(req));
const maybeCtx = async (req: any) => { try { return await requireSession(bearer(req)); } catch { return null; } };

router.post('/communities', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const { name, description, privacy, rules } = req.body ?? {};
    if (typeof name !== 'string' || name.length < 2 || name.length > 120) throw badRequest('Name must be 2-120 characters');
    if (privacy && !['public', 'private'].includes(privacy)) throw badRequest('Invalid privacy');
    if (rules !== undefined && !Array.isArray(rules)) throw badRequest('Rules must be an array');
    const community = await svc.createCommunity(Number(ctx.userId), { name, description, privacy, rules });
    res.status(201).json({ community });
  } catch (e) { next(e); }
});

router.get('/communities', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    const result = await svc.listCommunities(Number(ctx?.userId ?? 0), {
      search: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/communities/:slug', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    res.json({ community: await svc.getCommunityBySlug(req.params.slug, Number(ctx?.userId ?? 0)) });
  } catch (e) { next(e); }
});

router.patch('/communities/:slug', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ community: await svc.updateCommunity(Number(ctx.userId), req.params.slug, req.body) });
  } catch (e) { next(e); }
});

router.post('/communities/:slug/join', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ community: await svc.joinCommunity(Number(ctx.userId), req.params.slug) });
  } catch (e) { next(e); }
});

router.post('/communities/:slug/leave', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json(await svc.leaveCommunity(Number(ctx.userId), req.params.slug));
  } catch (e) { next(e); }
});

router.post('/communities/:slug/invite', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    if (!username) throw badRequest('username is required');
    res.json(await svc.inviteMember(Number(ctx.userId), req.params.slug, username));
  } catch (e) { next(e); }
});

router.post('/communities/:slug/invite/accept', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ community: await svc.acceptInvite(Number(ctx.userId), req.params.slug) });
  } catch (e) { next(e); }
});

router.post('/communities/:slug/members/:username/role', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const role = req.body?.role;
    if (!['admin', 'moderator', 'member'].includes(role)) throw badRequest('Invalid role');
    res.json(await svc.setMemberRole(Number(ctx.userId), req.params.slug, req.params.username, role));
  } catch (e) { next(e); }
});

router.get('/communities/:slug/members', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    res.json({ members: await svc.listMembers(req.params.slug, Number(ctx?.userId ?? 0)) });
  } catch (e) { next(e); }
});

router.get('/communities/:slug/posts', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    const viewerId = Number(ctx?.userId ?? 0);
    const community = await svc.getCommunityBySlug(req.params.slug, viewerId);
    if (community.privacy === 'private' && !community.myRole) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This community is private' } });
      return;
    }
    const result = await svc.listCommunityPosts(community, viewerId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/communities/:slug/posts/:postId/pin', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const pinned = req.body?.pinned === false ? false : true;
    res.json(await pinPost(Number(ctx.userId), req.params.slug, Number(req.params.postId), pinned));
  } catch (e) { next(e); }
});

router.post('/communities/:slug/posts/:postId/moderate', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json(await moderatePost(Number(ctx.userId), req.params.slug, Number(req.params.postId)));
  } catch (e) { next(e); }
});

export default router;
