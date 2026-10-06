import { Router } from 'express';
import { register, verifyEmail, login, logout, requireSession, requestPasswordReset, resetPassword, changePassword, listSessions, revokeSession, getUserById, lastTokenFor, } from './authService.js';

async function latestTokenForEmail(email: string, purpose: 'email_verify' | 'password_reset') {
  return lastTokenFor(email, purpose);
}

const router = Router();
const bearer = (req: any): string | undefined =>
  (req.headers.authorization ?? '').startsWith('Bearer ')
    ? (req.headers.authorization as string).slice(7)
    : undefined;

router.post('/auth/register', async (req, res, next) => {
  try {
    const { user, verifyToken } = await register(req.body);
    res.status(201).json({ user, verifyToken });
  } catch (e) { next(e); }
});

router.post('/auth/verify', async (req, res, next) => {
  try {
    await verifyEmail(String(req.body?.token ?? ''));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { user, token } = await login(req.body, req.headers['user-agent'] as string, req.ip);
    res.json({ user, token });
  } catch (e) { next(e); }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    await logout(bearer(req) as string);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/auth/password/reset-request', async (req, res, next) => {
  try {
    await requestPasswordReset(String(req.body?.email ?? ''));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/auth/password/reset', async (req, res, next) => {
  try {
    await resetPassword(String(req.body?.token ?? ''), String(req.body?.password ?? ''));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const ctx = await requireSession(bearer(req));
    res.json({ user: await getUserById(ctx.userId) });
  } catch (e) { next(e); }
});

router.post('/auth/password/change', async (req, res, next) => {
  try {
    const ctx = await requireSession(bearer(req));
    await changePassword(ctx, String(req.body?.currentPassword ?? ''), String(req.body?.password ?? ''));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/auth/sessions', async (req, res, next) => {
  try {
    const ctx = await requireSession(bearer(req));
    res.json({ sessions: await listSessions(ctx) });
  } catch (e) { next(e); }
});

router.post('/auth/sessions/:id/revoke', async (req, res, next) => {
  try {
    const ctx = await requireSession(bearer(req));
    await revokeSession(ctx, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/auth/dev-verification-token', async (req, res, next) => {
  // Dev convenience transport: returns the most recent outstanding token for
  // an email. Replace with real email delivery in production.
  try {
    const email = String(req.body?.email ?? '');
    const purpose = req.body?.purpose === 'password_reset' ? 'password_reset' : 'email_verify';
    const token = await latestTokenForEmail(email, purpose);
    if (!token) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No outstanding token' } });
    res.json({ token });
  } catch (e) { next(e); }
});

export default router;
