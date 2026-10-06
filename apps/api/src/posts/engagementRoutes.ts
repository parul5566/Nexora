// @ts-nocheck
import { Router } from 'express';
import { requireAuth, attachOptionalUser } from '../middleware/requireAuth.js';
import { REACTION_TYPES, react, addComment, editComment, deleteComment, reactComment, listComments } from './engagementService.js';
import { badRequest } from '@nexora/shared';
;
const router = Router();
function parseReaction(v) {
    if (v === null || v === 'none' || v === '')
        return null;
    if (!REACTION_TYPES.includes(v))
        throw badRequest(`Reaction must be one of: ${REACTION_TYPES.join(', ')}, or 'none' to clear`);
    return v;
}
router.post('/posts/:id/reactions', requireAuth, async (req,  res,  next) => {
    try {
        const type = parseReaction(req.body?.type);
        const summary = await react(req.ctx.userId, Number(req.params.id), type);
        res.json({ reactions: summary });
    }
    catch (e) {
        next(e);
    }
});
router.get('/posts/:id/comments', attachOptionalUser, async (req,  res,  next) => {
    try {
        if (!req.ctx)
            return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const result = await listComments(req.ctx.userId, Number(req.params.id), {
            parentId: req.query.parentId ? Number(req.query.parentId) : null,
            cursor: req.query.cursor || null,
            limit,
        });
        res.json(result);
    }
    catch (e) {
        next(e);
    }
});
router.post('/posts/:id/comments', requireAuth, async (req,  res,  next) => {
    try {
        const { content, parentId } = req.body ?? {};
        if (typeof content !== 'string')
            throw badRequest('content is required');
        const comment = await addComment(req.ctx.userId, Number(req.params.id), content, parentId != null ? Number(parentId) : null);
        res.status(201).json({ comment });
    }
    catch (e) {
        next(e);
    }
});
router.patch('/comments/:id', requireAuth, async (req,  res,  next) => {
    try {
        const comment = await editComment(req.ctx.userId, Number(req.params.id), String(req.body?.content ?? ''));
        res.json({ comment });
    }
    catch (e) {
        next(e);
    }
});
router.delete('/comments/:id', requireAuth, async (req,  res,  next) => {
    try {
        await deleteComment(req.ctx.userId, Number(req.params.id));
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
router.post('/comments/:id/reactions', requireAuth, async (req,  res,  next) => {
    try {
        const type = parseReaction(req.body?.type);
        const reactions = await reactComment(req.ctx.userId, Number(req.params.id), type);
        res.json({ reactions });
    }
    catch (e) {
        next(e);
    }
});
export default router;
