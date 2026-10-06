// @ts-nocheck
import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';
import { getPost } from './postService.js';
export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
const PAGE_LIMIT = 10;
async function reactionSummary(postId,  viewerId) {
    const [rows] = await pool.query('SELECT type, COUNT(*) AS c FROM reactions WHERE post_id = ? GROUP BY type', [postId]);
    const counts = {};
    let total = 0;
    for (const r of rows) {
        counts[r.type] = Number(r.c);
        total += Number(r.c);
    }
    let my = null;
    if (viewerId !== null) {
        const [mine] = await pool.query('SELECT type FROM reactions WHERE user_id = ? AND post_id = ?', [viewerId, postId]);
        my = mine[0]?.type ?? null;
    }
    const topTypes = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    return { counts, total, myReaction: my, topTypes };
}
async function hydrateComments(postId,  viewerId,  opts) {
    const params = [postId, opts.limit + 1];
    let parentClause = 'AND c.parent_id IS NULL';
    let cursorClause = '';
    if (opts.parentId !== null) {
        parentClause = 'AND c.parent_id = ?';
        params.splice(1, 0, opts.parentId);
    }
    if (opts.cursor) {
        cursorClause = 'AND c.id < ?';
        params.push(BigInt(opts.cursor));
    }
    const [rows] = await pool.query(`SELECT c.*, u.username, u.display_name, pr.avatar_url
     FROM comments c JOIN users u ON u.id = c.author_id LEFT JOIN profiles pr ON pr.user_id = c.author_id
     WHERE c.post_id = ? ${parentClause} AND c.deleted_at IS NULL ${cursorClause}
     ORDER BY c.id DESC LIMIT ?`, params);
    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    const ids = page.map((r) => r.id);
    const [rx] = ids.length
        ? await pool.query(`SELECT comment_id, COUNT(*) AS c FROM comment_reactions WHERE comment_id IN (?) GROUP BY comment_id`, [ids])
        : [[]];
    const [myRx] = ids.length
        ? await pool.query(`SELECT comment_id, type FROM comment_reactions WHERE user_id = ? AND comment_id IN (?)`, [viewerId, ids])
        : [[]];
    const view = async (r) => ({
        id: String(r.id),
        postId: String(r.post_id),
        parentId: r.parent_id ? String(r.parent_id) : null,
        author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
        content: r.content,
        edited: !!r.edited_at,
        deleted: false,
        reactions: {
            total: Number(rx.find((x) => x.comment_id === r.id)?.c ?? 0),
            myReaction: myRx.find((x) => Number(x.comment_id) === Number(r.id))?.type ?? null,
        },
        replies: [],
        createdAt: r.created_at,
    });
    const comments = [];
    for (const r of page)
        comments.push(await view(r));
    // fetch one page of replies per top-level comment
    if (opts.parentId === null) {
        for (const c of comments) {
            const sub = await hydrateComments(postId, viewerId, { parentId: Number(c.id), cursor: null, limit: 3 });
            c.replies = sub.comments;
        }
    }
    return { comments, nextCursor: hasMore ? String(page[page.length - 1].id) : null };
}
export async function react(userId,  postId,  type) {
    const post = await getPost(userId, postId); // ensures visible + exists
    if (type === null) {
        await pool.query('DELETE FROM reactions WHERE user_id = ? AND post_id = ?', [userId, postId]);
    }
    else {
        const [r] = await pool.query(`INSERT INTO reactions (user_id, post_id, type) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE type = VALUES(type), created_at = CURRENT_TIMESTAMP`, [userId, postId, type]);
        if (r.affectedRows === 1) {
            const { notify } = await import('../notifications/notificationService.js');
            const [owner] = await pool.query('SELECT author_id FROM posts WHERE id = ?', [postId]);
            if (owner[0]) {
                await notify(userId, BigInt(owner[0].author_id), 'reaction', { postId: String(postId), reactionType: type }, `reaction:${userId}:${postId}`).catch(() => { });
            }
        }
    }
    return reactionSummary(postId, userId);
}
export async function addComment(userId,  postId,  content,  parentId) {
    await getPost(userId, postId);
    if (parentId !== null) {
        const [p] = await pool.query('SELECT id, parent_id FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL', [parentId, postId]);
        if (!p[0])
            throw notFound('Parent comment not found');
        if (p[0].parent_id !== null)
            parentId = Number(p[0].parent_id); // keep threads 2 levels deep
    }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000)
        throw badRequest('Comment must be 1–2000 characters');
    const [r] = await pool.query('INSERT INTO comments (post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?)', [postId, userId, parentId, trimmed]);
    // notifications: reply to parent author, comment to post author, mentions to mentioned users
    try {
        const { notify } = await import('../notifications/notificationService.js');
        const { extractMentions } = await import('./postService.js');
        const [owner] = await pool.query('SELECT author_id FROM posts WHERE id = ?', [postId]);
        if (owner[0]) {
            const dedupe = `comment:${userId}:${postId}:${parentId ?? 0}`;
            if (parentId !== null) {
                const [parent] = await pool.query('SELECT author_id FROM comments WHERE id = ?', [parentId]);
                if (parent[0])
                    await notify(userId, BigInt(parent[0].author_id), 'reply', { postId: String(postId), commentId: String(r.insertId) }, dedupe);
            }
            else {
                await notify(userId, BigInt(owner[0].author_id), 'comment', { postId: String(postId), commentId: String(r.insertId) }, dedupe);
            }
        }
        for (const username of extractMentions(trimmed)) {
            const [m] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (m[0])
                await notify(userId, BigInt(m[0].id), 'mention', { postId: String(postId) }, `mention:${userId}:${postId}:${username}`);
        }
    }
    catch { /* notification failures never break commenting */ }
    const [rows] = await pool.query(`SELECT c.*, u.username, u.display_name, pr.avatar_url
     FROM comments c JOIN users u ON u.id = c.author_id LEFT JOIN profiles pr ON pr.user_id = c.author_id
     WHERE c.id = ?`, [r.insertId]);
    return {
        id: String(rows[0].id),
        postId: String(rows[0].post_id),
        parentId: rows[0].parent_id ? String(rows[0].parent_id) : null,
        author: { username: rows[0].username, displayName: rows[0].display_name, avatarUrl: rows[0].avatar_url },
        content: rows[0].content,
        edited: false,
        deleted: false,
        reactions: { total: 0, myReaction: null },
        replies: [],
        createdAt: rows[0].created_at,
    };
}
export async function editComment(userId,  commentId,  content) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000)
        throw badRequest('Comment must be 1–2000 characters');
    const [r] = await pool.query('UPDATE comments SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND author_id = ? AND deleted_at IS NULL', [trimmed, commentId, userId]);
    if (!r.affectedRows)
        throw notFound('Comment not found');
    return (await listComments(userId, Number((await getCommentRow(commentId)).post_id), { parentId: null, cursor: null, limit: 1 })).comments[0] ?? (await getComment(userId, commentId));
}
async function getCommentRow(commentId) {
    const [rows] = await pool.query('SELECT * FROM comments WHERE id = ?', [commentId]);
    if (!rows[0])
        throw notFound('Comment not found');
    return rows[0];
}
export async function getComment(userId,  commentId) {
    const row = await getCommentRow(commentId);
    const { comments } = await hydrateComments(Number(row.post_id), userId, { parentId: null, cursor: null, limit: 50 });
    const found = comments.find((c) => c.id === String(commentId))
        ?? comments.flatMap((c) => c.replies).find((c) => c.id === String(commentId));
    if (!found)
        throw notFound('Comment not found');
    return found;
}
export async function deleteComment(userId,  commentId) {
    const row = await getCommentRow(commentId);
    const [post] = await pool.query('SELECT author_id FROM posts WHERE id = ?', [row.post_id]);
    const isCommentAuthor = BigInt(row.author_id) === userId;
    const isPostAuthor = post[0] && BigInt(post[0].author_id) === userId;
    if (!isCommentAuthor && !isPostAuthor)
        throw forbidden('Not allowed to delete this comment');
    await pool.query('UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [commentId]);
}
export async function reactComment(userId,  commentId,  type) {
    await getCommentRow(commentId);
    if (type === null) {
        await pool.query('DELETE FROM comment_reactions WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
    }
    else {
        await pool.query(`INSERT INTO comment_reactions (user_id, comment_id, type) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE type = VALUES(type)`, [userId, commentId, type]);
    }
    const [agg] = await pool.query('SELECT COUNT(*) AS c FROM comment_reactions WHERE comment_id = ?', [commentId]);
    const [mine] = await pool.query('SELECT type FROM comment_reactions WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
    return { total: Number(agg[0].c), myReaction: mine[0]?.type ?? null };
}
export async function listComments(userId,  postId,  opts) {
    await getPost(userId, postId);
    return hydrateComments(postId, userId, opts);
}
