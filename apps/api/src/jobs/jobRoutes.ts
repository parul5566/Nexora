import { Router } from 'express';
import { requireSession } from '../auth/authService.js';
import * as svc from './jobService.js';
import { badRequest } from '@nexora/shared';

const router = Router();

const bearer = (req: any) =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req: any) => requireSession(bearer(req));

router.post('/companies/:slug/jobs', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const job = await svc.createJob(Number(ctx.userId), req.params.slug, req.body ?? {});
    res.status(201).json({ job });
  } catch (e) { next(e); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const result = await svc.searchJobs(Number(ctx.userId), {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      location: typeof req.query.location === 'string' ? req.query.location : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      remote: req.query.remote === '1' || req.query.remote === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/jobs/saved', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ jobs: await svc.listSavedJobs(Number(ctx.userId)) });
  } catch (e) { next(e); }
});

router.get('/jobs/applications', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ applications: await svc.listMyApplications(Number(ctx.userId)) });
  } catch (e) { next(e); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ job: await svc.getJob(Number(req.params.id), Number(ctx.userId)) });
  } catch (e) { next(e); }
});

router.post('/jobs/:id/apply', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json(await svc.applyToJob(Number(ctx.userId), Number(req.params.id), req.body ?? {}));
  } catch (e) { next(e); }
});

router.post('/jobs/:id/save', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const save = req.body?.saved === false ? false : true;
    res.json(await svc.saveJob(Number(ctx.userId), Number(req.params.id), save));
  } catch (e) { next(e); }
});

router.get('/jobs/:id/applicants', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ applicants: await svc.listApplicants(Number(ctx.userId), Number(req.params.id)) });
  } catch (e) { next(e); }
});

router.patch('/applications/:id/status', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const status = req.body?.status;
    if (typeof status !== 'string') throw badRequest('status is required');
    res.json(await svc.updateApplicationStatus(Number(ctx.userId), Number(req.params.id), status));
  } catch (e) { next(e); }
});

export default router;
