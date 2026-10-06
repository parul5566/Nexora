import { pool } from '../db/database.js';
import { notFound } from '@nexora/shared';

export type Range = '7d' | '30d' | '90d' | 'all';

function sinceFor(range: Range): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export interface PostStat {
  id: string;
  type: string;
  excerpt: string;
  createdAt: string;
  reactions: number;
  comments: number;
  score: number;
}

export interface ReelStat {
  id: string;
  caption: string;
  createdAt: string;
  views: number;
  likes: number;
  watchSeconds: number;
  avgWatchSeconds: number;
}

export interface StoryStat {
  id: string;
  views: number;
  createdAt: string;
}

export interface AudienceStat {
  followers: number;
  following: number;
  newFollowers: number;
  reach: number;
  engagement: number;
  watchSeconds: number;
}

export interface CreatorDashboard {
  range: Range;
  posts: PostStat[];
  reels: ReelStat[];
  stories: StoryStat[];
  audience: AudienceStat;
}

/** Aggregated, real analytics for the logged-in creator over a time range. */
export async function getCreatorDashboard(
  userId: bigint,
  range: Range = '30d',
): Promise<CreatorDashboard> {
  const uid = Number(userId);
  const since = sinceFor(range);
  const sinceSql = since ? 'AND p.created_at >= ?' : '';
  const args: unknown[] = [];
  if (since) args.push(since);

  const [postRows] = await pool.query(
    `SELECT p.id, p.type, p.content, p.created_at,
            (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reactions,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comments
     FROM posts p
     WHERE p.author_id = ? AND p.deleted_at IS NULL ${sinceSql}
     ORDER BY p.id DESC LIMIT 50`,
    [uid, ...args],
  );
  const posts: PostStat[] = (postRows as any[]).map((r) => ({
    id: String(r.id),
    type: r.type,
    excerpt: String(r.content ?? '').slice(0, 120),
    createdAt: new Date(r.created_at).toISOString(),
    reactions: Number(r.reactions),
    comments: Number(r.comments),
    score: Number(r.reactions) * 2 + Number(r.comments) * 3,
  }));

  const sinceReelSql = since ? 'AND r.created_at >= ?' : '';
  const [reelRows] = await pool.query(
    `SELECT r.id, r.caption, r.created_at, r.views_count,
            (SELECT COUNT(*) FROM reel_likes l WHERE l.reel_id = r.id) AS likes,
            COALESCE((SELECT SUM(w.seconds) FROM reel_watch_events w WHERE w.reel_id = r.id ${since ? 'AND w.created_at >= ?' : ''}), 0) AS watch_seconds
     FROM reels r
     WHERE r.author_id = ? AND r.deleted_at IS NULL ${sinceReelSql}
     ORDER BY r.id DESC LIMIT 50`,
    since
      ? [uid, since, since]
      : [uid],
  );
  const reels: ReelStat[] = (reelRows as any[]).map((r) => ({
    id: String(r.id),
    caption: String(r.caption ?? '').slice(0, 120),
    createdAt: new Date(r.created_at).toISOString(),
    views: Number(r.views_count),
    likes: Number(r.likes),
    watchSeconds: Number(r.watch_seconds),
    avgWatchSeconds: Number(r.views_count) > 0 ? Math.round(Number(r.watch_seconds) / Number(r.views_count)) : 0,
  }));

  const sinceStorySql = since ? 'AND s.created_at >= ?' : '';
  const [storyRows] = await pool.query(
    `SELECT s.id, s.created_at,
            (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id) AS views
     FROM stories s
     WHERE s.author_id = ? AND s.deleted_at IS NULL ${sinceStorySql}
     ORDER BY s.id DESC LIMIT 50`,
    [uid, ...(since ? [since] : [])],
  );
  const stories: StoryStat[] = (storyRows as any[]).map((r) => ({
    id: String(r.id),
    views: Number(r.views),
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Audience: followers, new followers in range, reach = distinct users who
  // reacted/commented/viewed/watched creator content, engagement = interactions.
  const [followerRow]: any = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM follows f WHERE f.followee_id = ?) AS followers,
       (SELECT COUNT(*) FROM follows f2 WHERE f2.follower_id = ?) AS following`,
    [uid, uid],
  );
  const [newFollowerRow]: any = await pool.query(
    `SELECT COUNT(*) AS c FROM follows f WHERE f.followee_id = ? ${since ? 'AND f.created_at >= ?' : ''}`,
    [uid, ...(since ? [since] : [])],
  );
  const [reachRow]: any = await pool.query(
    `SELECT COUNT(DISTINCT uid) AS c FROM (
       SELECT r.user_id AS uid FROM reactions r JOIN posts p ON p.id = r.post_id
         WHERE p.author_id = ? ${since ? 'AND r.created_at >= ?' : ''}
       UNION
       SELECT c.author_id AS uid FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE p.author_id = ? AND c.deleted_at IS NULL ${since ? 'AND c.created_at >= ?' : ''}
       UNION
       SELECT w.user_id AS uid FROM reel_watch_events w JOIN reels r ON r.id = w.reel_id
         WHERE r.author_id = ? ${since ? 'AND w.created_at >= ?' : ''}
       UNION
       SELECT v.viewer_id AS uid FROM story_views v JOIN stories s ON s.id = v.story_id
         WHERE s.author_id = ? ${since ? 'AND v.viewed_at >= ?' : ''}
     ) t`,
    since
      ? [uid, since, uid, since, uid, since, uid, since]
      : [uid, uid, uid, uid],
  );
  const [engageRow]: any = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id = r.post_id WHERE p.author_id = ? ${since ? 'AND r.created_at >= ?' : ''}) +
       (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.author_id = ? AND c.deleted_at IS NULL ${since ? 'AND c.created_at >= ?' : ''}) +
       (SELECT COUNT(*) FROM reel_likes l JOIN reels r ON r.id = l.reel_id WHERE r.author_id = ? ${since ? 'AND l.created_at >= ?' : ''}) AS c`,
    since
      ? [uid, since, uid, since, uid, since]
      : [uid, uid, uid],
  );
  const [watchRow]: any = await pool.query(
    `SELECT COALESCE(SUM(w.seconds), 0) AS s FROM reel_watch_events w
     JOIN reels r ON r.id = w.reel_id
     WHERE r.author_id = ? ${since ? 'AND w.created_at >= ?' : ''}`,
    [uid, ...(since ? [since] : [])],
  );

  return {
    range,
    posts,
    reels,
    stories,
    audience: {
      followers: Number(followerRow[0]?.followers ?? 0),
      following: Number(followerRow[0]?.following ?? 0),
      newFollowers: Number(newFollowerRow[0]?.c ?? 0),
      reach: Number(reachRow[0]?.c ?? 0),
      engagement: Number(engageRow[0]?.c ?? 0),
      watchSeconds: Number(watchRow[0]?.s ?? 0),
    },
  };
}

/** Per-post stats for one owned post (authorization enforced by caller). */
export async function getPostAnalytics(postId: number, userId: bigint): Promise<PostStat & { bookmarks: number }> {
  const [rows]: any = await pool.query(
    `SELECT p.id, p.type, p.content, p.created_at,
            (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reactions,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comments,
            (SELECT COUNT(*) FROM bookmarks b WHERE b.post_id = p.id) AS bookmarks
     FROM posts p
     WHERE p.id = ? AND p.author_id = ? AND p.deleted_at IS NULL`,
    [postId, Number(userId)],
  );
  const r = (rows as any[])[0];
  if (!r) throw notFound('Post not found');
  return {
    id: String(r.id),
    type: r.type,
    excerpt: String(r.content ?? '').slice(0, 120),
    createdAt: new Date(r.created_at).toISOString(),
    reactions: Number(r.reactions),
    comments: Number(r.comments),
    score: Number(r.reactions) * 2 + Number(r.comments) * 3,
    bookmarks: Number(r.bookmarks),
  };
}

/** Per-reel stats for one owned reel (authorization enforced by caller). */
export async function getReelAnalytics(reelId: number, userId: bigint): Promise<ReelStat> {
  const [rows]: any = await pool.query(
    `SELECT r.id, r.caption, r.created_at, r.views_count,
            (SELECT COUNT(*) FROM reel_likes l WHERE l.reel_id = r.id) AS likes,
            COALESCE((SELECT SUM(w.seconds) FROM reel_watch_events w WHERE w.reel_id = r.id), 0) AS watch_seconds
     FROM reels r
     WHERE r.id = ? AND r.author_id = ? AND r.deleted_at IS NULL`,
    [reelId, Number(userId)],
  );
  const r = (rows as any[])[0];
  if (!r) throw notFound('Reel not found');
  return {
    id: String(r.id),
    caption: String(r.caption ?? '').slice(0, 120),
    createdAt: new Date(r.created_at).toISOString(),
    views: Number(r.views_count),
    likes: Number(r.likes),
    watchSeconds: Number(r.watch_seconds),
    avgWatchSeconds: Number(r.views_count) > 0 ? Math.round(Number(r.watch_seconds) / Number(r.views_count)) : 0,
  };
}
