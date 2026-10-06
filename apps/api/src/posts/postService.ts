// @ts-nocheck
import { pool } from '../db/database.js';
import { badRequest, notFound, forbidden, conflict } from '@nexora/shared';
import { isFollowing, userIdByUsername } from '../social/graphService.js';
const MAX_CONTENT = 5000;
export function extractHashtags(content) {
    if (!content)
        return [];
    return [...new Set((content.match(/#([\p{L}\p{N}_]{1,100})/gu) ?? []).map((t) => t.slice(1).toLowerCase()))];
}
export function extractMentions(content) {
    if (!content)
        return [];
    return [...new Set((content.match(/@([a-z0-9_]{3,30})/gi) ?? []).map((m) => m.slice(1).toLowerCase()))];
}
export async function canViewPost(viewerId,  post) {
    // Drafts are author-only, regardless of visibility.
    if (post.is_draft)
        return viewerId !== null && BigInt(post.author_id) === viewerId;
    if (BigInt(post.author_id) === viewerId)
        return true;
    if (post.visibility === 'public')
        return true;
    if (viewerId === null)
        return false;
    if (post.visibility === 'followers')
        return isFollowing(viewerId, post.author_id);
    return false; // private = author only
}
async function hydratePosts(viewerId,  rows) {
    if (!rows.length)
        return [];
    const ids = rows.map((r) => r.id);
    const [mediaRows, tagRows, mentionRows, pollRows] = await Promise.all([
        pool.query(`SELECT * FROM post_media WHERE post_id IN (?)`, [ids]),
        pool.query(`SELECT ph.post_id, h.tag FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id IN (?)`, [ids]),
        pool.query(`SELECT pm.post_id, u.username FROM post_mentions pm JOIN users u ON u.id = pm.user_id WHERE pm.post_id IN (?)`, [ids]),
        pool.query(`SELECT * FROM polls WHERE post_id IN (?)`, [ids]),
    ]);
    let bookmarkSet = new Set();
    if (viewerId !== null) {
        const [b] = await pool.query('SELECT post_id FROM bookmarks WHERE user_id = ? AND post_id IN (?)', [viewerId, ids]);
        bookmarkSet = new Set(b.map((r) => Number(r.post_id)));
    }
    void mediaRows;
    void tagRows;
    void mentionRows;
    void pollRows;
    return [];
}
/** Full post hydration in a handful of queries. */
export async function getPostsByIds(viewerId,  ids) {
    if (!ids.length)
        return [];
    const [posts] = await pool.query(`SELECT p.*, u.username, u.display_name, pr.avatar_url
     FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN profiles pr ON pr.user_id = p.author_id
     WHERE p.id IN (?) AND p.deleted_at IS NULL ORDER BY p.id DESC`, [ids]);
    const visible = [];
    for (const p of posts)
        if (await canViewPost(viewerId, p))
            visible.push(p);
    const idList = visible.map((p) => p.id);
    const [media] = idList.length ? await pool.query(`SELECT * FROM post_media WHERE post_id IN (?)`, [idList]) : [[]];
    const [tags] = idList.length ? await pool.query(`SELECT ph.post_id, h.tag FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id IN (?)`, [idList]) : [[]];
    const [mentions] = idList.length ? await pool.query(`SELECT pm.post_id, u.username FROM post_mentions pm JOIN users u ON u.id = pm.user_id WHERE pm.post_id IN (?)`, [idList]) : [[]];
    const [polls] = idList.length ? await pool.query(`SELECT * FROM polls WHERE post_id IN (?)`, [idList]) : [[]];
    const pollIds = polls.map((p) => p.id);
    const [options] = pollIds.length ? await pool.query(`SELECT * FROM poll_options WHERE poll_id IN (?) ORDER BY position`, [pollIds]) : [[]];
    const [votes] = pollIds.length ? await pool.query(`SELECT * FROM poll_votes WHERE poll_id IN (?)`, [pollIds]) : [[]];
    let bookmarks = new Set();
    if (viewerId !== null && idList.length) {
        const [b] = await pool.query('SELECT post_id FROM bookmarks WHERE user_id = ? AND post_id IN (?)', [viewerId, idList]);
        bookmarks = new Set(b.map((r) => Number(r.post_id)));
    }
    const [rxRows] = idList.length ? await pool.query('SELECT post_id, type, COUNT(*) AS c FROM reactions WHERE post_id IN (?) GROUP BY post_id, type', [idList]) : [[]];
    const [myRx] = viewerId !== null && idList.length
        ? await pool.query('SELECT post_id, type FROM reactions WHERE user_id = ? AND post_id IN (?)', [viewerId, idList]) : [[]];
    const [cCounts] = idList.length ? await pool.query('SELECT post_id, COUNT(*) AS c FROM comments WHERE post_id IN (?) AND deleted_at IS NULL GROUP BY post_id', [idList]) : [[]];
    return visible.map((p) => {
        const poll = polls.find((pl) => Number(pl.post_id) === Number(p.id));
        let pollView;
        if (poll) {
            const opts = options.filter((o) => o.poll_id === poll.id);
            const pollVoteList = votes.filter((v) => v.poll_id === poll.id);
            const total = pollVoteList.length;
            pollView = {
                question: poll.question,
                options: opts.map((o) => {
                    const c = pollVoteList.filter((v) => v.option_id === o.id).length;
                    return {
                        id: String(o.id),
                        label: o.label,
                        votes: c,
                        percent: total ? Math.round((c / total) * 100) : 0,
                    };
                }),
                totalVotes: total,
                userVotedOptionId: viewerId !== null
                    ? String(pollVoteList.find((v) => BigInt(v.user_id) === viewerId)?.option_id ?? '') : null,
            };
        }
        return {
            id: String(p.id),
            author: { username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url },
            type: p.type,
            content: p.content,
            linkUrl: p.link_url,
            visibility: p.visibility,
            media: media.filter((m) => Number(m.post_id) === Number(p.id)).map((m) => ({ url: m.media_url, kind: m.media_kind })),
            poll: pollView,
            hashtags: tags.filter((t) => Number(t.post_id) === Number(p.id)).map((t) => t.tag),
            mentions: mentions.filter((m) => Number(m.post_id) === Number(p.id)).map((m) => m.username),
            isDraft: !!p.is_draft,
            edited: !!p.edited_at,
            deleted: false,
            bookmarked: bookmarks.has(Number(p.id)),
            reactions: (() => {
                const counts = {};
                let total = 0;
                for (const r of rxRows.filter((x) => Number(x.post_id) === Number(p.id))) {
                    counts[r.type] = Number(r.c);
                    total += Number(r.c);
                }
                return {
                    counts, total,
                    myReaction: myRx.find((x) => Number(x.post_id) === Number(p.id))?.type ?? null,
                    topTypes: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
                };
            })(),
            commentCount: Number(cCounts.find((x) => Number(x.post_id) === Number(p.id))?.c ?? 0),
            createdAt: p.created_at,
        };
    });
}
export async function createPost(authorId,  raw) {
    const type = raw.type ?? (raw.poll ? 'poll' : raw.mediaUrls?.length ? (raw.mediaUrls[0].kind === 'video' ? 'video' : 'image') : raw.linkUrl ? 'link' : 'text');
    const content = raw.content ? String(raw.content).trim() : null;
    if (!content && type === 'text')
        throw badRequest('Post content is required');
    if (content && content.length > MAX_CONTENT)
        throw badRequest(`Post exceeds ${MAX_CONTENT} characters`);
    if (type === 'poll') {
        if (!raw.poll || raw.poll.options.length < 2)
            throw badRequest('Poll needs at least 2 options');
        if (raw.poll.options.length > 8)
            throw badRequest('Poll allows at most 8 options');
    }
    if (type === 'link' && !raw.linkUrl)
        throw badRequest('Link posts need a URL');
    if (raw.linkUrl && !/^https?:\/\//i.test(raw.linkUrl))
        throw badRequest('Link must be an http(s) URL');
    const visibility = raw.visibility ?? 'public';
    if (!['public', 'followers', 'private'].includes(visibility))
        throw badRequest('Invalid visibility');
    if (raw.communityId) {
        const { getMembership } = await import('../communities/communityService.js');
        const membership = await getMembership(Number(authorId), raw.communityId);
        if (!membership)
            throw forbidden('Join the community before posting');
    }
    if (raw.companyId) {
        const { requireCompanyRole } = await import('../companies/companyService.js');
        await requireCompanyRole(Number(authorId), raw.companyId, ['admin', 'recruiter']);
    }
    let postId = 0;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [r] = await conn.query('INSERT INTO posts (author_id, type, content, visibility, link_url, community_id, company_id, is_draft) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [authorId, type, content, visibility, raw.linkUrl ?? null, raw.communityId ?? null, raw.companyId ?? null, raw.draft ? 1 : 0]);
        postId = r.insertId;
        for (const m of raw.mediaUrls ?? []) {
            if (!m.url.startsWith('/media/'))
                throw badRequest('Invalid media URL');
            await conn.query('INSERT INTO post_media (post_id, media_url, media_kind) VALUES (?, ?, ?)', [postId, m.url, m.kind]);
        }
        if (type === 'poll' && raw.poll) {
            const [pr] = await conn.query('INSERT INTO polls (post_id, question) VALUES (?, ?)', [postId, raw.poll.question ?? null]);
            const pollId = pr.insertId;
            for (let i = 0; i < raw.poll.options.length; i++) {
                await conn.query('INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)', [pollId, raw.poll.options[i], i]);
            }
        }
        for (const tag of extractHashtags(content)) {
            const [hr] = await conn.query('INSERT IGNORE INTO hashtags (tag) VALUES (?)', [tag]);
            const [rows] = hr.insertId
                ? [{}]
                : await conn.query('SELECT id FROM hashtags WHERE tag = ?', [tag]);
            const tagId = hr.insertId || rows[0].id;
            await conn.query('INSERT IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)', [postId, tagId]);
        }
        for (const username of extractMentions(content)) {
            try {
                const uid = await userIdByUsername(username);
                await conn.query('INSERT IGNORE INTO post_mentions (post_id, user_id) VALUES (?, ?)', [postId, uid]);
            }
            catch { /* mention of nonexistent user: leave as plain text */ }
        }
        await conn.commit();
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
    // mention notifications (after commit)
    for (const username of extractMentions(content)) {
        try {
            const { notify } = await import('../notifications/notificationService.js');
            const uid = await userIdByUsername(username);
            await notify(authorId, uid, 'mention', { postId: String(postId) }, `mention:${authorId}:${postId}:${username}`);
        }
        catch { /* nonexistent user */ }
    }
    const [view] = await getPostsByIds(authorId, [postId]);
    return view;
}
async function getPostRow(postId) {
    const [rows] = await pool.query('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', [postId]);
    if (!rows.length)
        throw notFound('Post not found');
    return rows[0];
}
async function requireOwnPost(userId,  postId) {
    const post = await getPostRow(postId);
    if (BigInt(post.author_id) !== userId)
        throw forbidden('You can only modify your own posts');
    return post;
}
export async function editPost(userId,  postId,  raw) {
    const post = await requireOwnPost(userId, postId);
    if (raw.content !== undefined) {
        const content = String(raw.content).trim();
        if (content.length > MAX_CONTENT)
            throw badRequest(`Post exceeds ${MAX_CONTENT} characters`);
        await pool.query('UPDATE posts SET content = ?, edited_at = NOW() WHERE id = ?', [content, postId]);
        // re-extract hashtags/mentions
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE ph FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id = ?', [postId]);
            await conn.query('DELETE FROM post_mentions WHERE post_id = ?', [postId]);
            for (const tag of extractHashtags(content)) {
                const [hr] = await conn.query('INSERT IGNORE INTO hashtags (tag) VALUES (?)', [tag]);
                const [rows] = hr.insertId ? [{}] : await conn.query('SELECT id FROM hashtags WHERE tag = ?', [tag]);
                await conn.query('INSERT IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)', [postId, hr.insertId || rows[0].id]);
            }
            for (const username of extractMentions(content)) {
                try {
                    const uid = await userIdByUsername(username);
                    await conn.query('INSERT IGNORE INTO post_mentions (post_id, user_id) VALUES (?, ?)', [postId, uid]);
                }
                catch { /* ignore */ }
            }
            await conn.commit();
        }
        catch (e) {
            await conn.rollback();
            throw e;
        }
        finally {
            conn.release();
        }
    }
    if (raw.visibility !== undefined) {
        if (!['public', 'followers', 'private'].includes(raw.visibility))
            throw badRequest('Invalid visibility');
        await pool.query('UPDATE posts SET visibility = ? WHERE id = ?', [raw.visibility, postId]);
    }
    if (raw.draft === false && post.is_draft) {
        await pool.query('UPDATE posts SET is_draft = 0 WHERE id = ?', [postId]);
    }
    const [view] = await getPostsByIds(userId, [postId]);
    return view;
}
export async function deletePost(userId,  postId) {
    await requireOwnPost(userId, postId);
    await pool.query('UPDATE posts SET deleted_at = NOW() WHERE id = ?', [postId]);
}
export async function getPost(viewerId,  postId) {
    const post = await getPostRow(postId);
    if (!(await canViewPost(viewerId, post)))
        throw notFound('Post not found');
    const [view] = await getPostsByIds(viewerId, [postId]);
    return view;
}
export async function votePoll(userId,  postId,  optionId) {
    const post = await getPostRow(postId);
    if (!(await canViewPost(userId, post)))
        throw notFound('Post not found');
    const [polls] = await pool.query('SELECT id FROM polls WHERE post_id = ?', [postId]);
    if (!polls.length)
        throw badRequest('This post is not a poll');
    const pollId = polls[0].id;
    const [opts] = await pool.query('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [optionId, pollId]);
    if (!opts.length)
        throw badRequest('Invalid poll option');
    try {
        await pool.query('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)', [pollId, optionId, userId]);
    }
    catch (err) {
        if (err?.code === 'ER_DUP_ENTRY')
            throw conflict('You already voted in this poll');
        throw err;
    }
}
export async function bookmark(userId,  postId,  on) {
    const post = await getPostRow(postId);
    if (!(await canViewPost(userId, post)))
        throw notFound('Post not found');
    if (on)
        await pool.query('INSERT IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    else
        await pool.query('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?', [userId, postId]);
}
export async function listBookmarks(userId,  cursor,  limit = 20) {
    const l = Math.min(Math.max(1, limit), 50);
    const params = [userId];
    let cursorSql = '';
    if (cursor) {
        cursorSql = ' AND p.id < ?';
        params.push(BigInt(cursor));
    }
    params.push(l + 1);
    const [rows] = await pool.query(`SELECT p.id FROM bookmarks b JOIN posts p ON p.id = b.post_id
     WHERE b.user_id = ? AND p.deleted_at IS NULL${cursorSql} ORDER BY p.id DESC LIMIT ?`, params);
    const hasMore = rows.length > l;
    const items = await getPostsByIds(userId, rows.slice(0, l).map((r) => r.id));
    return { items, nextCursor: hasMore ? String(rows[l - 1].id) : null };
}
export async function listUserPosts(viewerId,  username,  opts) {
    const authorId = await userIdByUsername(username);
    const l = Math.min(Math.max(1, opts.limit ?? 20), 50);
    const params = [authorId];
    let cursorSql = '';
    if (opts.cursor) {
        cursorSql = ' AND p.id < ?';
        params.push(BigInt(opts.cursor));
    }
    params.push(l + 1);
    const draftSql = opts.includeDrafts ? '' : ' AND p.is_draft = 0';
    const [rows] = await pool.query(`SELECT p.* FROM posts p WHERE p.author_id = ? AND p.deleted_at IS NULL${draftSql}${cursorSql} ORDER BY p.id DESC LIMIT ?`, params);
    // viewer permission filter
    const allowed = [];
    for (const p of rows)
        if (await canViewPost(viewerId, p))
            allowed.push(p.id);
    const hasMore = rows.length > l;
    const items = await getPostsByIds(viewerId, allowed.slice(0, l));
    return { items, nextCursor: hasMore && allowed.length ? String(allowed[allowed.length - 1]) : null };
}
export async function listHashtagPosts(viewerId,  tag,  cursor,  limit = 20) {
    const l = Math.min(Math.max(1, limit), 50);
    const clean = tag.toLowerCase().trim();
    const params = [clean];
    let cursorSql = '';
    if (cursor) {
        cursorSql = ' AND p.id < ?';
        params.push(BigInt(cursor));
    }
    params.push(l * 3 + 1);
    const [rows] = await pool.query(`SELECT p.* FROM posts p
     JOIN post_hashtags ph ON ph.post_id = p.id
     JOIN hashtags h ON h.id = ph.hashtag_id
     WHERE h.tag = ? AND p.deleted_at IS NULL AND p.visibility = 'public' AND p.is_draft = 0${cursorSql}
     ORDER BY p.id DESC LIMIT ?`, params);
    const hasMore = rows.length > l;
    const items = await getPostsByIds(viewerId, rows.slice(0, l).map((r) => r.id));
    return { items, nextCursor: hasMore ? String(rows[l - 1].id) : null };
}

// ===== Type declarations (recovered during corruption repair) =====
export interface PostInput {
  content?: string;
  type?: 'text' | 'image' | 'video' | 'link' | 'poll';
  visibility?: 'public' | 'followers' | 'private';
  linkUrl?: string | null;
  mediaUrls?: Array<{ url: string; kind: 'image' | 'video' }>;
  pollOptions?: string[];
  pollQuestion?: string | null;
  communityId?: number | null;
  companyId?: number | null;
  isDraft?: boolean;
}

export interface PostView {
  id: string;
  type: string;
  content: string | null;
  visibility: string;
  linkUrl: string | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
  communityId: number | null;
  companyId: number | null;
  pinned: boolean;
  createdAt: string;
  edited: boolean;
  isDraft: boolean;
  media: Array<{ url: string; kind: 'image' | 'video' }>;
  poll: { question: string | null; options: Array<{ id: string; label: string; votes: number }>; myVote?: string | null; userVotedOptionId?: string | null; totalVotes: number } | null;
  hashtags: string[];
  mentions: string[];
  bookmarked: boolean;
  reactions?: { counts: Record<string, number>; total: number; myReaction: string | null; topTypes: string[] };
  commentCount?: number;
}
