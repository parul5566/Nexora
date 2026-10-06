import { Router } from 'express';
import { requireSession } from '../auth/authService.js';
import * as svc from './professionalService.js';
import { badRequest } from '@nexora/shared';
import { pool } from '../db/database.js';

const router = Router();

const SECTIONS = ['experiences', 'education', 'skills', 'certifications', 'projects'] as const;

const bearer = (req: any) =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req: any) => requireSession(bearer(req));

function sectionOf(req: any): (typeof SECTIONS)[number] {
  const s = req.params.section;
  if (!SECTIONS.includes(s)) throw badRequest('Unknown professional section');
  return s;
}

// ---- Fixed paths FIRST so /:section can never shadow them ----

router.post('/professional/mode', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    await svc.setProfessionalMode(Number(ctx.userId), !!req.body?.enabled, req.body?.headline, req.body?.industry);
    res.json({ enabled: !!req.body?.enabled });
  } catch (e) { next(e); }
});

router.post('/professional/recommendations', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const { username, text, relationship } = req.body ?? {};
    if (typeof username !== 'string' || typeof text !== 'string') throw badRequest('username and text are required');
    res.json(await svc.writeRecommendation(Number(ctx.userId), username, text, relationship));
  } catch (e) { next(e); }
});

router.get('/professional/recommendations/pending', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ recommendations: await svc.listPendingRecommendations(Number(ctx.userId)) });
  } catch (e) { next(e); }
});

router.post('/professional/recommendations/:authorUsername/respond', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const accept = req.body?.accept !== false;
    res.json(await svc.respondToRecommendation(Number(ctx.userId), req.params.authorUsername, accept));
  } catch (e) { next(e); }
});

router.get('/users/:username/professional', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [req.params.username]) as any;
    if (!rows.length) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    res.json(await svc.getProfessionalProfile(Number(rows[0].id)));
  } catch (e) { next(e); }
});

// ---- Section CRUD (parametric routes last) ----

router.post('/professional/:section', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    const entry = await svc.addSectionEntry(Number(ctx.userId), sectionOf(req), req.body ?? {});
    res.status(201).json({ entry });
  } catch (e) { next(e); }
});

router.get('/professional/:section', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    res.json({ entries: await svc.listSection(Number(ctx.userId), sectionOf(req)) });
  } catch (e) { next(e); }
});

router.patch('/professional/:section/:id', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    await svc.updateSectionEntry(Number(ctx.userId), sectionOf(req), Number(req.params.id), req.body ?? {});
    res.json({ updated: true });
  } catch (e) { next(e); }
});

router.delete('/professional/:section/:id', async (req, res, next) => {
  try {
    const ctx = await ctxOf(req);
    await svc.removeSectionEntry(Number(ctx.userId), sectionOf(req), Number(req.params.id));
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

export default router;
