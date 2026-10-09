// @ts-nocheck -- recovered from compiled output
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { updateProfile, getProfile, setProfileImage, follow, unfollow, block, unblock, mute, unmute, listFollows, relationshipState, mutualCount, userIdByUsername, requestConnection, acceptConnection, rejectConnection, removeConnection, listPendingIncoming, listPendingOutgoing, } from '../social/graphService.js';
import { requireSession } from '../auth/authService.js';
import { forbidden } from '@nexora/shared';
const router = Router();
const bearer = (req) => (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req) => requireSession(bearer(req));
const maybeCtx = async (req) => {
    try {
        return await requireSession(bearer(req));
    }
    catch {
        return null;
    }
};
// ---- media upload (avatar/cover) — lightweight store; full pipeline is Module 06 ----
const MEDIA_DIR = process.env.MEDIA_DIR || '/workspace/apps/api/media';
fs.mkdirSync(path.join(MEDIA_DIR, 'avatars'), { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, path.join(MEDIA_DIR, 'avatars')),
        filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype) ||
            ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
        cb(null, ok);
    },
});
// ---- profile routes ----
router.get('/profiles/me', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        const [rows] = await (await import('../db/database.js')).pool.query('SELECT username FROM users WHERE id = ?', [ctx.userId]);
        res.json({ profile: await getProfile(ctx.userId, rows[0].username) });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/profiles/me', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ profile: await updateProfile(ctx, req.body) });
    }
    catch (e) {
        next(e);
    }
});
router.post('/profiles/me/:kind(avatar|cover)', upload.single('image'), async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        if (!req.file)
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No image uploaded or unsupported type' } });
        const url = `/media/avatars/${req.file.filename}`;
        const out = await setProfileImage(ctx, req.params.kind, url);
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
router.get('/users/:username', async (req, res, next) => {
    try {
        const ctx = await maybeCtx(req);
        const profile = await getProfile(ctx?.userId ?? null, req.params.username);
        res.json({ profile });
    }
    catch (e) {
        next(e);
    }
});
// ---- social graph routes ----
router.post('/follows/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await follow(ctx.userId, req.params.username);
        const target = await userIdByUsername(req.params.username);
        res.json({ relationship: await relationshipState(ctx.userId, target) });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/follows/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await unfollow(ctx.userId, req.params.username);
        const target = await userIdByUsername(req.params.username);
        res.json({ relationship: await relationshipState(ctx.userId, target) });
    }
    catch (e) {
        next(e);
    }
});
router.get('/follows/:username/followers', async (req, res, next) => {
    try {
        const target = await userIdByUsername(req.params.username);
        const ctx = await maybeCtx(req);
        const self = ctx && BigInt(ctx.userId) === target;
        const profile = await getProfile(ctx?.userId ?? null, req.params.username);
        if (profile.limited && !self)
            throw forbidden('This list is private');
        res.json(await listFollows(target, 'followers', ctx?.userId ?? null, req.query.cursor || null, Number(req.query.limit) || 20));
    }
    catch (e) {
        next(e);
    }
});
router.get('/follows/:username/following', async (req, res, next) => {
    try {
        const target = await userIdByUsername(req.params.username);
        const ctx = await maybeCtx(req);
        const self = ctx && BigInt(ctx.userId) === target;
        const profile = await getProfile(ctx?.userId ?? null, req.params.username);
        if (profile.limited && !self)
            throw forbidden('This list is private');
        res.json(await listFollows(target, 'following', ctx?.userId ?? null, req.query.cursor || null, Number(req.query.limit) || 20));
    }
    catch (e) {
        next(e);
    }
});
router.post('/blocks/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await block(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/blocks/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await unblock(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.post('/mutes/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await mute(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/mutes/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await unmute(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.get('/relationship/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        const target = await userIdByUsername(req.params.username);
        res.json({ relationship: await relationshipState(ctx.userId, target), mutualCount: await mutualCount(ctx.userId, target) });
    }
    catch (e) {
        next(e);
    }
});
// ---- connections (bidirectional) ----
router.post('/connections/:username/request', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ relationship: await requestConnection(ctx.userId, req.params.username) });
    }
    catch (e) {
        next(e);
    }
});
router.post('/connections/:username/accept', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ relationship: await acceptConnection(ctx.userId, req.params.username) });
    }
    catch (e) {
        next(e);
    }
});
router.post('/connections/:username/reject', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await rejectConnection(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/connections/:username', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        await removeConnection(ctx.userId, req.params.username);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.get('/connections/requests/incoming', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ requests: await listPendingIncoming(ctx.userId) });
    }
    catch (e) {
        next(e);
    }
});
router.get('/connections/requests/outgoing', async (req, res, next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ requests: await listPendingOutgoing(ctx.userId) });
    }
    catch (e) {
        next(e);
    }
});
// (shared /media/upload now lives in mediaRoutes.ts — Module 06 pipeline)
export default router;
//# sourceMappingURL=socialRoutes.js.map