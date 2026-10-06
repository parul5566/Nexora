// @ts-nocheck
import { Router } from 'express';
import { pool } from '../db/database.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getPostsByIds } from '../posts/postService.js';
import { badRequest } from '@nexora/shared';
const router = Router();
async function ctxOf(req) {
    return { userId: req.ctx.userId };
}
// GET /search/users?q=
router.get('/search/users', requireAuth, async (req,  res,  next) => {
    try {
        const q = String(req.query.q ?? '').trim();
        if (!q)
            throw badRequest('Query q is required');
        const like = `%${q}%`;
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const { userId } = await ctxOf(req);
        const [rows] = await pool.query(`SELECT u.id, u.username, u.display_name, pr.avatar_url, pr.bio,
              (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers,
              EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = ? AND f2.followee_id = u.id) AS is_following
       FROM users u
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE (u.username LIKE ? OR u.display_name LIKE ?)
         AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
         AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
       ORDER BY (u.username = ?) DESC, u.username LIKE CONCAT(?, '%') DESC, followers DESC
       LIMIT ?`, [userId, like, like, userId, userId, q.toLowerCase(), q.toLowerCase(), limit]);
        res.json({
            users: rows.map((r) => ({
                id: String(r.id),
                username: r.username,
                displayName: r.display_name,
                avatarUrl: r.avatar_url,
                bio: r.bio,
                followers: Number(r.followers),
                isFollowing: !!r.is_following,
            })),
        });
    }
    catch (e) {
        next(e);
    }
});
// GET /search/posts?q=
router.get('/search/posts', requireAuth, async (req,  res,  next) => {
    try {
        const q = String(req.query.q ?? '').trim();
        if (!q)
            throw badRequest('Query q is required');
        const like = `%${q}%`;
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const { userId } = await ctxOf(req);
        const params = [like, userId, userId, userId, userId, limit + 1];
        let cursorSql = '';
        if (req.query.cursor) {
            cursorSql = ' AND p.id < ?';
            params.splice(5, 0, BigInt(String(req.query.cursor)));
        }
        const [rows] = await pool.query(`SELECT p.id FROM posts p
       WHERE p.content LIKE ? AND p.deleted_at IS NULL AND p.is_draft = 0
         AND (p.community_id IS NULL OR NOT EXISTS (
               SELECT 1 FROM communities c WHERE c.id = p.community_id AND c.privacy = 'private'
                 AND NOT EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = ?)))
         AND (p.visibility = 'public'
              OR (p.visibility = 'followers' AND EXISTS (
                    SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = p.author_id)
                  OR p.author_id = ?)
              OR (p.visibility = 'private' AND p.author_id = ?))
         ${cursorSql}
       ORDER BY p.id DESC LIMIT ?`, params);
        const hasMore = rows.length > limit;
        const ids = rows.slice(0, limit).map((r) => Number(r.id));
        const items = await getPostsByIds(userId, ids);
        res.json({ items, nextCursor: hasMore && ids.length ? String(ids[ids.length - 1]) : null });
    }
    catch (e) {
        next(e);
    }
});
// GET /search/hashtags?q=
router.get('/search/hashtags', requireAuth, async (req,  res,  next) => {
    try {
        const q = String(req.query.q ?? '').trim().toLowerCase();
        if (!q)
            throw badRequest('Query q is required');
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const [rows] = await pool.query(`SELECT h.tag, COUNT(ph.post_id) AS uses
       FROM hashtags h
       JOIN post_hashtags ph ON ph.hashtag_id = h.id
       JOIN posts p ON p.id = ph.post_id AND p.deleted_at IS NULL AND p.is_draft = 0 AND p.visibility = 'public'
       WHERE h.tag LIKE CONCAT(?, '%')
       GROUP BY h.id ORDER BY uses DESC LIMIT ?`, [q, limit]);
        res.json({ hashtags: rows.map((r) => ({ tag: r.tag, uses: Number(r.uses) })) });
    }
    catch (e) {
        next(e);
    }
});
// GET /trending/hashtags (Redis-cached, 60s TTL)
router.get('/trending/hashtags', requireAuth, async (_req,  res,  next) => {
    try {
        const { getCache } = await import('../cache/kv.js');
        const cache = await getCache();
        const cached = await cache.get('trending:hashtags:v1');
        if (cached) {
            res.setHeader('X-Cache', 'hit');
            return void res.json(JSON.parse(cached));
        }
        const [rows] = await pool.query(`SELECT h.tag, COUNT(ph.post_id) AS uses
       FROM hashtags h
       JOIN post_hashtags ph ON ph.hashtag_id = h.id
       JOIN posts p ON p.id = ph.post_id AND p.deleted_at IS NULL AND p.is_draft = 0 AND p.visibility = 'public'
       WHERE p.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY h.id ORDER BY uses DESC LIMIT 10`);
        const body = { hashtags: rows.map((r) => ({ tag: r.tag, uses: Number(r.uses) })) };
        await cache.set('trending:hashtags:v1', JSON.stringify(body), 60);
        res.setHeader('X-Cache', 'miss');
        res.json(body);
    }
    catch (e) {
        next(e);
    }
});
export default router;
