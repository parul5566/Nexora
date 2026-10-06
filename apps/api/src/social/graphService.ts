// @ts-nocheck -- recovered from compiled output
// @ts-nocheck -- recovered from compiled output
import { pool } from '../db/database.js';
import { notFound, badRequest, forbidden, conflict } from '@nexora/shared';
const LIMIT_BIO = 500;
const LIMIT_SHORT = 160;
function clampStr(v, max) {
    if (v === undefined)
        return undefined;
    if (v === null)
        return null;
    const s = String(v).trim();
    if (s.length === 0)
        return null;
    if (s.length > max)
        throw badRequest(`Field exceeds ${max} characters`);
    return s;
}
export async function getOrCreateProfile(userId) {
    await pool.query('INSERT IGNORE INTO profiles (user_id) VALUES (?)', [userId]);
}
export async function updateProfile(ctx, raw) {
    const input = raw;
    await getOrCreateProfile(ctx.userId);
    const sets = [];
    const vals = [];
    const bio = clampStr(input.bio, LIMIT_BIO);
    if (bio !== undefined) {
        sets.push('bio = ?');
        vals.push(bio);
    }
    const headline = clampStr(input.headline, LIMIT_SHORT);
    if (headline !== undefined) {
        sets.push('headline = ?');
        vals.push(headline);
    }
    const location = clampStr(input.location, 120);
    if (location !== undefined) {
        sets.push('location = ?');
        vals.push(location);
    }
    const website = clampStr(input.website, 255);
    if (website !== undefined) {
        if (website && !/^https?:\/\//i.test(website))
            throw badRequest('Website must be an http(s) URL');
        sets.push('website = ?');
        vals.push(website);
    }
    if (input.privacyMode !== undefined) {
        if (input.privacyMode !== 'public' && input.privacyMode !== 'private')
            throw badRequest('Invalid privacy mode');
        sets.push('privacy_mode = ?');
        vals.push(input.privacyMode);
    }
    if (sets.length) {
        vals.push(ctx.userId);
        await pool.query(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`, vals);
    }
    return getProfile(ctx.userId, (await usernameFor(ctx.userId)));
}
export async function setProfileImage(ctx, kind, url) {
    const col = kind === 'avatar' ? 'avatar_url' : 'cover_url';
    if (!url.startsWith('/media/'))
        throw badRequest('Invalid media URL');
    await getOrCreateProfile(ctx.userId);
    await pool.query(`UPDATE profiles SET ${col} = ? WHERE user_id = ?`, [url, ctx.userId]);
    return { url };
}
export async function getProfile(viewerId, username) {
    const [rows] = await pool.query(`SELECT u.id, u.username, u.display_name, u.email_verified_at, u.created_at,
            p.bio, p.headline, p.location, p.website, p.avatar_url, p.cover_url, p.privacy_mode,
            (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS follower_count,
            (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS following_count
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.username = ?`, [username]);
    if (!rows.length)
        throw notFound('User not found');
    const r = rows[0];
    const isSelf = viewerId !== null && BigInt(viewerId) === BigInt(r.id);
    const limited = !isSelf && r.privacy_mode === 'private' && !(await isFollowing(viewerId, r.id));
    const view = {
        id: String(r.id),
        username: r.username,
        displayName: r.display_name,
        bio: limited ? null : r.bio,
        headline: limited ? null : r.headline,
        location: limited ? null : r.location,
        website: limited ? null : r.website,
        avatarUrl: r.avatar_url,
        coverUrl: r.cover_url,
        privacyMode: r.privacy_mode,
        followerCount: Number(r.follower_count),
        followingCount: Number(r.following_count),
        emailVerified: !!r.email_verified_at,
        createdAt: r.created_at,
        isSelf,
        limited,
    };
    if (!isSelf && viewerId !== null) {
        view.relationship = await relationshipState(viewerId, r.id);
    }
    return view;
}
// ---- Social graph primitives (single source of truth; consumed by feed etc.) ----
export async function isFollowing(follower, followee) {
    if (follower === null)
        return false;
    const [rows] = await pool.query('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', [follower, followee]);
    return rows.length > 0;
}
export async function follow(follower, followeeUsername) {
    const target = await userIdByUsername(followeeUsername);
    if (target === follower)
        throw badRequest('You cannot follow yourself');
    if (await isBlocked(target, follower))
        throw forbidden('You cannot follow this user');
    if (await isBlocked(follower, target))
        throw forbidden('Unblock this user first');
    const [ins] = await pool.query('INSERT IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)', [follower, target]);
    if (ins.affectedRows === 1) {
        const { notify } = await import('../notifications/notificationService.js');
        await notify(follower, target, 'follow', {}, `follow:${follower}:${target}`).catch(() => { });
    }
}
export async function unfollow(follower, followeeUsername) {
    const target = await userIdByUsername(followeeUsername);
    await pool.query('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [follower, target]);
}
export async function isBlocked(blocker, blocked) {
    const [rows] = await pool.query('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [blocker, blocked]);
    return rows.length > 0;
}
export async function block(blocker, username) {
    const target = await userIdByUsername(username);
    if (target === blocker)
        throw badRequest('You cannot block yourself');
    // blocking removes the relationship both ways
    await pool.query(`DELETE f FROM follows f WHERE (f.follower_id = ? AND f.followee_id = ?) OR (f.follower_id = ? AND f.followee_id = ?)`, [blocker, target, target, blocker]);
    await pool.query(`DELETE cr FROM connection_requests cr
     WHERE (cr.requester_id = ? AND cr.addressee_id = ?) OR (cr.requester_id = ? AND cr.addressee_id = ?)`, [blocker, target, target, blocker]);
    await pool.query('INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', [blocker, target]);
}
export async function unblock(blocker, username) {
    const target = await userIdByUsername(username);
    await pool.query('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [blocker, target]);
}
export async function mute(muter, username) {
    const target = await userIdByUsername(username);
    if (target === muter)
        throw badRequest('You cannot mute yourself');
    await pool.query('INSERT IGNORE INTO mutes (muter_id, muted_id) VALUES (?, ?)', [muter, target]);
}
export async function unmute(muter, username) {
    const target = await userIdByUsername(username);
    await pool.query('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?', [muter, target]);
}
export async function relationshipState(a, b) {
    if (a === b)
        return 'self';
    if (await isBlocked(a, b))
        return 'blocked';
    if (await isBlocked(b, a))
        return 'blocked_by';
    const [aFollowsB, bFollowsA] = await Promise.all([isFollowing(a, b), isFollowing(b, a)]);
    const [crRows] = await pool.query('SELECT requester_id, status FROM connection_requests WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', [a, b, b, a]);
    const accepted = crRows.some((r) => r.status === 'accepted');
    const pending = crRows.find((r) => r.status === 'pending');
    if (accepted)
        return 'connected';
    if (pending)
        return BigInt(pending.requester_id) === a ? 'pending_outgoing' : 'pending_incoming';
    if (aFollowsB && bFollowsA)
        return 'mutuals';
    if (aFollowsB)
        return 'following';
    if (bFollowsA)
        return 'followed_by';
    return 'none';
}
export async function usernameFor(userId) {
    const [rows] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
    return rows[0]?.username;
}
export async function userIdByUsername(username) {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (!rows.length)
        throw notFound('User not found');
    return BigInt(rows[0].id);
}
export async function listFollows(userId, kind, cursor, limit = 20) {
    const l = Math.min(Math.max(1, limit), 50);
    const joinCol = kind === 'followers' ? 'f.followee_id' : 'f.follower_id';
    const selectCol = kind === 'followers' ? 'f.follower_id' : 'f.followee_id';
    const params = [userId];
    let cursorSql = '';
    if (cursor) {
        cursorSql = ` AND u.id < ?`;
        params.push(BigInt(cursor));
    }
    params.push(l + 1);
    const [rows] = await pool.query(`SELECT u.id, u.username, u.display_name, p.avatar_url
     FROM follows f JOIN users u ON u.id = ${selectCol}
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE ${joinCol} = ?${cursorSql}
     ORDER BY u.id DESC LIMIT ?`, params);
    const hasMore = rows.length > l;
    const items = rows.slice(0, l).map((r) => ({
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
    }));
    return {
        items,
        nextCursor: hasMore ? String(rows[l - 1].id) : null,
    };
}
export async function mutualCount(a, b) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM follows f1
     JOIN follows f2 ON f1.followee_id = f2.follower_id
     WHERE f1.follower_id = ? AND f2.followee_id = ?`, [a, b]);
    return Number(rows[0].c);
}
// ---- Connections (bidirectional, LinkedIn-style) ----
export async function requestConnection(requester, username) {
    const addressee = await userIdByUsername(username);
    if (addressee === requester)
        throw badRequest('You cannot connect with yourself');
    if (await isBlocked(addressee, requester))
        throw forbidden('You cannot connect with this user');
    if (await isBlocked(requester, addressee))
        throw forbidden('Unblock this user first');
    const [existing] = await pool.query('SELECT * FROM connection_requests WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', [requester, addressee, addressee, requester]);
    const { notify } = await import('../notifications/notificationService.js');
    if (existing.length) {
        const e = existing[0];
        if (e.status === 'accepted')
            throw conflict('You are already connected');
        if (e.status === 'pending')
            throw conflict('A connection request already exists');
        // rejected → allow a fresh request from either side
        await pool.query('UPDATE connection_requests SET requester_id = ?, addressee_id = ?, status = ? WHERE id = ?', [requester, addressee, 'pending', e.id]);
    }
    else {
        await pool.query('INSERT INTO connection_requests (requester_id, addressee_id) VALUES (?, ?)', [requester, addressee]);
    }
    await notify(requester, addressee, 'connection_request', {}, `connreq:${requester}:${addressee}`).catch(() => { });
    return relationshipState(requester, addressee);
}
export async function acceptConnection(ctxUserId, username) {
    const requester = await userIdByUsername(username);
    const [rows] = await pool.query("SELECT id FROM connection_requests WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'", [requester, ctxUserId]);
    if (!rows.length)
        throw notFound('No pending request from this user');
    await pool.query("UPDATE connection_requests SET status = 'accepted' WHERE id = ?", [rows[0].id]);
    const { notify } = await import('../notifications/notificationService.js');
    await notify(ctxUserId, requester, 'connection_accept', {}, `connacc:${ctxUserId}:${requester}`).catch(() => { });
    return relationshipState(ctxUserId, requester);
}
export async function rejectConnection(ctxUserId, username) {
    const requester = await userIdByUsername(username);
    const [res] = await pool.query("UPDATE connection_requests SET status = 'rejected' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'", [requester, ctxUserId]);
    if (res.affectedRows === 0)
        throw notFound('No pending request from this user');
}
export async function removeConnection(ctxUserId, username) {
    const other = await userIdByUsername(username);
    const [res] = await pool.query('DELETE FROM connection_requests WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', [ctxUserId, other, other, ctxUserId]);
    if (res.affectedRows === 0)
        throw notFound('No connection with this user');
}
export async function listPendingIncoming(userId) {
    const [rows] = await pool.query(`SELECT u.username, u.display_name, p.avatar_url
     FROM connection_requests cr
     JOIN users u ON u.id = cr.requester_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE cr.addressee_id = ? AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`, [userId]);
    return rows.map((r) => ({ username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }));
}
//# sourceMappingURL=graphService.js.map
//# sourceMappingURL=graphService.js.map