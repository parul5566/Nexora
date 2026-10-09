import { pool } from '../db/database.js';
import { badRequest, notFound, forbidden } from '@nexora/shared';

export interface ReelView {
  id: string;
  author: { username: string; displayName: string; avatarUrl: string | null; isFollowing?: boolean };
  videoUrl: string;
  caption: string | null;
  views: number;
  likes: number;
  liked: boolean;
  createdAt: string;
}

export async function createReel(
  authorId: bigint,
  input: { videoUrl: string; caption?: string | null },
): Promise<ReelView> {
  if (!input.videoUrl.startsWith('/media/videos/')) throw badRequest('Reels need an uploaded video from the media pipeline');
  const caption = input.caption?.trim() || null;
  if (caption && caption.length > 500) throw badRequest('Caption too long (max 500)');
  const [r]: any = await pool.query(
    'INSERT INTO reels (author_id, video_url, caption) VALUES (?, ?, ?)',
    [authorId, input.videoUrl, caption],
  );
  return (await getReel(authorId, Number(r.insertId)))!;
}

async function hydrate(rows: any[], viewerId: bigint): Promise<ReelView[]> {
  const ids = rows.map((r) => r.id);
  const [likes]: any = ids.length
    ? await pool.query('SELECT reel_id, COUNT(*) AS c FROM reel_likes WHERE reel_id IN (?) GROUP BY reel_id', [ids]) : [[]];
  const [mine]: any = ids.length
    ? await pool.query('SELECT reel_id FROM reel_likes WHERE user_id = ? AND reel_id IN (?)', [viewerId, ids]) : [[]];
  const authorIds = [...new Set(rows.map((r: any) => Number(r.author_id)))];
  const [follows]: any = authorIds.length
    ? await pool.query('SELECT followee_id FROM follows WHERE follower_id = ? AND followee_id IN (?)', [viewerId, authorIds]) : [[]];
  const followedSet = new Set(follows.map((f: any) => Number(f.followee_id)));
  return rows.map((r) => ({
    id: String(r.id),
    author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, isFollowing: followedSet.has(Number(r.author_id)) },
    videoUrl: r.video_url,
    caption: r.caption,
    views: Number(r.views_count),
    likes: Number(likes.find((l: any) => Number(l.reel_id) === Number(r.id))?.c ?? 0),
    liked: !!mine.find((m: any) => Number(m.reel_id) === Number(r.id)),
    createdAt: r.created_at,
  }));
}

export async function getReel(viewerId: bigint, reelId: number): Promise<ReelView | null> {
  const [rows]: any = await pool.query(
    `SELECT r.*, u.username, u.display_name, pr.avatar_url
     FROM reels r JOIN users u ON u.id = r.author_id LEFT JOIN profiles pr ON pr.user_id = r.author_id
     WHERE r.id = ? AND r.deleted_at IS NULL`, [reelId]);
  if (!rows[0]) return null;
  return (await hydrate(rows, viewerId))[0];
}

export async function listReels(
  viewerId: bigint,
  opts: { cursor: string | null; limit: number },
): Promise<{ reels: ReelView[]; nextCursor: string | null }> {
  const l = Math.min(Math.max(1, opts.limit), 20);
  const params: unknown[] = [];
  let cursorSql = '';
  if (opts.cursor) { cursorSql = ' AND r.id < ?'; params.push(BigInt(opts.cursor)); }
  params.push(l + 1);
  const [rows]: any = await pool.query(
    `SELECT r.*, u.username, u.display_name, pr.avatar_url
     FROM reels r JOIN users u ON u.id = r.author_id LEFT JOIN profiles pr ON pr.user_id = r.author_id
     WHERE r.deleted_at IS NULL ${cursorSql}
     ORDER BY r.id DESC LIMIT ?`, params);
  const hasMore = rows.length > l;
  const page = rows.slice(0, l);
  return {
    reels: await hydrate(page, viewerId),
    nextCursor: hasMore && page.length ? String(page[page.length - 1].id) : null,
  };
}

export async function likeReel(userId: bigint, reelId: number, on: boolean): Promise<{ likes: number; liked: boolean }> {
  const [r]: any = await pool.query('SELECT id FROM reels WHERE id = ? AND deleted_at IS NULL', [reelId]);
  if (!r[0]) throw notFound('Reel not found');
  if (on) await pool.query('INSERT IGNORE INTO reel_likes (reel_id, user_id) VALUES (?, ?)', [reelId, userId]);
  else await pool.query('DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?', [reelId, userId]);
  const [c]: any = await pool.query('SELECT COUNT(*) AS c FROM reel_likes WHERE reel_id = ?', [reelId]);
  return { likes: Number(c[0].c), liked: on };
}

export async function registerView(reelId: number, userId?: bigint, seconds = 0): Promise<number> {
  const [r]: any = await pool.query(
    'UPDATE reels SET views_count = views_count + 1 WHERE id = ? AND deleted_at IS NULL', [reelId]);
  if (!r.affectedRows) throw notFound('Reel not found');
  await pool.query(
    'INSERT INTO reel_watch_events (reel_id, user_id, seconds) VALUES (?,?,?)',
    [reelId, userId ? Number(userId) : null, Math.max(0, Math.min(seconds, 36000))]
  ).catch(() => {});
  const [row]: any = await pool.query('SELECT views_count FROM reels WHERE id = ?', [reelId]);
  return Number(row[0].views_count);
}

export async function deleteReel(userId: bigint, reelId: number): Promise<void> {
  const [r]: any = await pool.query('SELECT author_id FROM reels WHERE id = ? AND deleted_at IS NULL', [reelId]);
  if (!r[0]) throw notFound('Reel not found');
  if (BigInt(r[0].author_id) !== userId) throw forbidden('Not your reel');
  await pool.query('UPDATE reels SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [reelId]);
}
