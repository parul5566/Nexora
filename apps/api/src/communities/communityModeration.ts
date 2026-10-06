// @ts-nocheck
import { pool } from '../db/database.js';
import { notFound, forbidden } from '@nexora/shared';
import { getCommunityBySlug, getMembership, requireRole } from './communityService.js';
/** Load post; enforce private-community membership before anything else. */
export async function communityGuardForPost(communityId,  viewerId) {
    if (communityId === null || communityId === undefined)
        return;
    const [rows] = await pool.query('SELECT privacy FROM communities WHERE id = ?', [communityId]);
    if (rows.length === 0)
        throw notFound('Community not found');
    if (rows[0].privacy === 'private') {
        const membership = viewerId ? await getMembership(viewerId, communityId) : null;
        if (!membership)
            throw forbidden('This community is private');
    }
}
export async function pinPost(actorId,  slug,  postId,  pinned) {
    const community = await getCommunityBySlug(slug, actorId);
    requireRole(community.myRole, ['owner', 'admin', 'moderator']);
    const [p] = await pool.query('SELECT id, community_id FROM posts WHERE id = ? AND deleted_at IS NULL', [postId]);
    if (p.length === 0)
        throw notFound('Post not found');
    if (Number(p[0].community_id) !== community.id)
        throw notFound('Post is not in this community');
    await pool.query('UPDATE posts SET pinned_at = ? WHERE id = ?', [pinned ? new Date() : null, postId]);
    return { pinned };
}
export async function moderatePost(actorId,  slug,  postId) {
    const community = await getCommunityBySlug(slug, actorId);
    requireRole(community.myRole, ['owner', 'admin', 'moderator']);
    const [p] = await pool.query('SELECT id, community_id FROM posts WHERE id = ? AND deleted_at IS NULL', [postId]);
    if (p.length === 0)
        throw notFound('Post not found');
    if (Number(p[0].community_id) !== community.id)
        throw notFound('Post is not in this community');
    await pool.query('UPDATE posts SET deleted_at = NOW(), pinned_at = NULL WHERE id = ?', [postId]);
    return { deleted: true };
}
