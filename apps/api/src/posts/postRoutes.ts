// @ts-nocheck
import { Router } from 'express';
import { createPost, editPost, deletePost, getPost, votePoll, bookmark, listBookmarks, listUserPosts, listHashtagPosts, } from './postService.js';
import { requireSession } from '../auth/authService.js';
const router = Router();
const bearer = (req) => (req.headers.authorization ?? '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
const ctxOf = async (req) => requireSession(bearer(req));
const maybeCtx = async (req) => { try {
    return await requireSession(bearer(req));
}
catch {
    return null;
} };
router.post('/posts', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        const view = await createPost(ctx.userId, req.body);
        res.status(201).json({ post: view });
    }
    catch (e) {
        next(e);
    }
});
router.get('/posts/:id', async (req,  res,  next) => {
    try {
        const ctx = await maybeCtx(req);
        res.json({ post: await getPost(ctx?.userId ?? null, Number(req.params.id)) });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/posts/:id', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        res.json({ post: await editPost(ctx.userId, Number(req.params.id), req.body) });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/posts/:id', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        await deletePost(ctx.userId, Number(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.post('/posts/:id/vote', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        await votePoll(ctx.userId, Number(req.params.id), Number(req.body?.optionId));
        res.json({ post: await getPost(ctx.userId, Number(req.params.id)) });
    }
    catch (e) {
        next(e);
    }
});
router.post('/posts/:id/bookmark', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        await bookmark(ctx.userId, Number(req.params.id), true);
        res.json({ bookmarked: true });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/posts/:id/bookmark', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        await bookmark(ctx.userId, Number(req.params.id), false);
        res.json({ bookmarked: false });
    }
    catch (e) {
        next(e);
    }
});
router.get('/bookmarks', async (req,  res,  next) => {
    try {
        const ctx = await ctxOf(req);
        res.json(await listBookmarks(ctx.userId, req.query.cursor || null, Number(req.query.limit) || 20));
    }
    catch (e) {
        next(e);
    }
});
router.get('/users/:username/posts', async (req,  res,  next) => {
    try {
        const ctx = await maybeCtx(req);
        // only the author sees their own drafts
        const includeDrafts = !!ctx && ctx.username === req.params.username;
        res.json(await listUserPosts(ctx?.userId ?? null, req.params.username, {
            cursor: req.query.cursor || null,
            limit: Number(req.query.limit) || 20,
            includeDrafts,
        }));
    }
    catch (e) {
        next(e);
    }
});
router.get('/hashtags/:tag/posts', async (req,  res,  next) => {
    try {
        const ctx = await maybeCtx(req);
        res.json(await listHashtagPosts(ctx?.userId ?? null, req.params.tag, req.query.cursor || null, Number(req.query.limit) || 20));
    }
    catch (e) {
        next(e);
    }
});
export default router;
