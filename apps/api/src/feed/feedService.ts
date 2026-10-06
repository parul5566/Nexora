import { pool } from '../db/database.js';
import { getPostsByIds, PostView } from '../posts/postService.js';

const PAGE = 20;

/**
 * Home feed: own posts + posts from followed users + connections, ranked.
 * Ranking: recency score (log-decayed) + engagement bonus (reactions*2 + comments*3).
 * Falls back to recent public posts when the viewer follows nobody.
 */
export async function homeFeed(
  viewerId: bigint,
  opts: { cursor: string | null; limit?: number; discover?: boolean },
): Promise<{ items: PostView[]; nextCursor: string | null; mode: 'following' | 'discover' }> {
  const l = Math.min(Math.max(1, opts.limit ?? PAGE), 50);

  let authorIds: string[] | null = [viewerId.toString()];
  if (opts.discover) {
    authorIds = null; // no author restriction — recent public posts from anyone
  } else {
    const [followed]: any = await pool.query(
      `SELECT followee_id AS id FROM follows WHERE follower_id = ?
       UNION SELECT addressee_id AS id FROM connection_requests WHERE requester_id = ? AND status = 'accepted'
       UNION SELECT requester_id AS id FROM connection_requests WHERE addressee_id = ? AND status = 'accepted'`,
      [viewerId, viewerId, viewerId],
    );
    authorIds = [viewerId.toString(), ...followed.map((r: any) => String(r.id))];
  }

  const fallbackToDiscover = !opts.cursor && authorIds !== null && authorIds.length === 1;

  // candidate pool: fetch a window older than the cursor, filter visibility in SQL
  const limit = Math.min(l * 3, 120);
  const cursorSqlParts: string[] = [];
  const cursorParams: unknown[] = [];
  if (opts.cursor) {
    const [scoreStr, idStr] = opts.cursor.split(':');
    const cursorDate = new Date(Number(scoreStr));
    cursorSqlParts.push(' AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))');
    cursorParams.push(cursorDate, cursorDate, BigInt(idStr));
  }
  const discover = opts.discover === true || fallbackToDiscover;
  const authorSql = discover ? 'p.visibility = \'public\'' : `p.author_id IN (?)`;
  const params: unknown[] = discover
    ? [...cursorParams, limit]
    : [authorIds!, viewerId, viewerId, viewerId, ...cursorParams, limit];
  const cursorSql = cursorSqlParts.join('');
  const [rows]: any = await pool.query(
    `SELECT p.id, p.created_at,
            (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS rx,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS cm
     FROM posts p
     WHERE ${authorSql} AND p.deleted_at IS NULL AND p.is_draft = 0
       ${discover ? '' : `AND (p.visibility = 'public'
            OR (p.visibility = 'followers' AND EXISTS (
                 SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = p.author_id)
                OR p.author_id = ?)
            OR (p.visibility = 'private' AND p.author_id = ?))`}
       ${cursorSql}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    params,
  );

  const mode: 'following' | 'discover' = discover ? 'discover' : 'following';

  // rank: hours since post → decay, engagement bonus
  const scored = rows.map((r: any) => {
    const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3_600_000;
    const recency = 100 / (1 + ageHours / 6); // half-life ~4h
    const engagement = Number(r.rx) * 2 + Number(r.cm) * 3;
    return { row: r, score: recency + engagement };
  }).sort((a: any, b: any) => b.score - a.score || Number(b.row.id) - Number(a.row.id));

  const page = scored.slice(0, l);
  const items = (await getPostsByIds(viewerId, page.map((s: any) => Number(s.row.id)))) as PostView[];
  const last = page[page.length - 1];
  return {
    items,
    nextCursor: scored.length > l && last
      ? `${new Date(last.row.created_at).getTime()}:${last.row.id}`
      : null,
    mode,
  };
}
