import { Router } from 'express';
import { requireSession } from '../auth/authService.js';
import * as svc from './companyService.js';
import { createPost, type PostInput } from '../posts/postService.js';
import { badRequest } from '@nexora/shared';

const router = Router();

const bearer = (req: any) =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req: any) => requireSession(bearer(req));
const maybeCtx = async (req: any) => { try { return await requireSession(bearer(req)); } catch { return null; } };

router.post('/companies', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const { name, tagline, industry, website, description, logoUrl } = req.body ?? {};
    if (typeof name !== 'string' || name.length < 2 || name.length > 160) throw badRequest('Name must be 2-160 characters');
    const company = await svc.createCompany(Number(ctx.userId), { name, tagline, industry, website, description, logoUrl });
    res.status(201).json({ company });
  } catch (e) { next(e); }
});

router.get('/companies', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    const result = await svc.listCompanies(
      Number(ctx?.userId ?? 0),
      typeof req.query.q === 'string' ? req.query.q : undefined,
      req.query.limit ? Number(req.query.limit) : 20,
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    );
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/companies/:slug', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    res.json({ company: await svc.getCompany(req.params.slug, Number(ctx?.userId ?? 0)) });
  } catch (e) { next(e); }
});

router.patch('/companies/:slug', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ company: await svc.updateCompany(Number(ctx.userId), req.params.slug, req.body ?? {}) });
  } catch (e) { next(e); }
});

router.post('/companies/:slug/admins', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const { username, role } = req.body ?? {};
    if (typeof username !== 'string') throw badRequest('username is required');
    if (!['admin', 'recruiter'].includes(role)) throw badRequest('role must be admin or recruiter');
    res.json(await svc.addCompanyAdmin(Number(ctx.userId), req.params.slug, username, role));
  } catch (e) { next(e); }
});

router.post('/companies/:slug/follow', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ company: await svc.followCompany(Number(ctx.userId), req.params.slug) });
  } catch (e) { next(e); }
});

router.post('/companies/:slug/unfollow', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ company: await svc.unfollowCompany(Number(ctx.userId), req.params.slug) });
  } catch (e) { next(e); }
});

router.get('/companies/:slug/posts', async (req, res, next) => {
  try {
    const ctx = await maybeCtx(req);
    const company = await svc.getCompany(req.params.slug, Number(ctx?.userId ?? 0));
    const result = await svc.listCompanyPosts(
      company, Number(ctx?.userId ?? 0),
      req.query.limit ? Number(req.query.limit) : 20,
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    );
    res.json(result);
  } catch (e) { next(e); }
});

// Post as the company (admin or recruiter)
router.post('/companies/:slug/posts', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const { company } = await svc.requireCompanyRole(Number(ctx.userId), req.params.slug, ['admin', 'recruiter']);
    const input = { ...(req.body as PostInput) } as PostInput & { companyId?: number };
    input.companyId = company.id;
    const post = await createPost(ctx.userId, input);
    res.status(201).json({ post });
  } catch (e) { next(e); }
});

router.get('/companies/:slug/analytics', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json(await svc.companyAnalytics(Number(ctx.userId), req.params.slug));
  } catch (e) { next(e); }
});

export default router;
