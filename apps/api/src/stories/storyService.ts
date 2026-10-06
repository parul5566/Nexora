import { pool } from '../db/database.js';
import { badRequest, notFound, forbidden } from '@nexora/shared';

export interface StoryView {
  id: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  mediaUrl: string | null;
  bgText: string | null;
  bgColor: string;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  viewCount?: number;
}

const ACTIVE = 'deleted_at IS NULL AND expires_at > NOW()';

export async function createStory(
  authorId: bigint,
  input: { mediaUrl?: string | null; bgText?: string | null; bgColor?: string },
): Promise<StoryView> {
  const mediaUrl = input.mediaUrl ?? null;
  const bgText = input.bgText?.trim() || null;
  if (!mediaUrl && !bgText) throw badRequest('Story needs media or text');
  if (mediaUrl && !mediaUrl.startsWith('/media/')) throw badRequest('Invalid media URL');
  if (bgText && bgText.length > 280) throw badRequest('Text too long (max 280)');
  const bgColor = /^#[0-9a-fA-F]{6}$/.test(input.bgColor ?? '') ? input.bgColor! : '#3b82f6';
  const [r]: any = await pool.query(
    `INSERT INTO stories (author_id, media_url, bg_text, bg_color, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [authorId, mediaUrl, bgText, bgColor],
  );
  return (await getStory(authorId, Number(r.insertId)))!;
}

export async function getStory(viewerId: bigint, storyId: number): Promise<StoryView | null> {
  const [rows]: any = await pool.query(
    `SELECT s.*, u.username, u.display_name, pr.avatar_url,
            EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = ?) AS seen
     FROM stories s JOIN users u ON u.id = s.author_id LEFT JOIN profiles pr ON pr.user_id = s.author_id
     WHERE s.id = ? AND ${ACTIVE}`, [viewerId, storyId]);
  if (!rows[0]) return null;
  return toView(rows[0]);
}

function toView(r: any): StoryView {
  return {
    id: String(r.id),
    author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
    mediaUrl: r.media_url,
    bgText: r.bg_text,
    bgColor: r.bg_color,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    seen: !!r.seen,
  };
}

export interface StoryGroup {
  author: { username: string; displayName: string; avatarUrl: string | null };
  stories: StoryView[];
  allSeen: boolean;
  isSelf: boolean;
}

/** Story bar: own stories + followed users' active stories, grouped, unseen first. */
export async function storyFeed(viewerId: bigint): Promise<StoryGroup[]> {
  const [rows]: any = await pool.query(
    `SELECT s.*, u.username, u.display_name, pr.avatar_url,
            EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = ?) AS seen
     FROM stories s
     JOIN users u ON u.id = s.author_id
     LEFT JOIN profiles pr ON pr.user_id = s.author_id
     WHERE ${ACTIVE}
       AND (s.author_id = ?
            OR s.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
     ORDER BY s.author_id, s.id ASC`, [viewerId, viewerId, viewerId]);

  const groups = new Map<string, StoryGroup>();
  for (const r of rows) {
    let g = groups.get(r.username);
    if (!g) {
      g = {
        author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
        stories: [],
        allSeen: true,
        isSelf: BigInt(r.author_id) === viewerId,
      };
      groups.set(r.username, g);
    }
    g.stories.push(toView(r));
    if (!r.seen) g.allSeen = false;
  }
  // self first, then unseen, then seen
  return [...groups.values()].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
    return a.author.username.localeCompare(b.author.username);
  });
}

export async function listUserStories(viewerId: bigint, username: string): Promise<StoryGroup | null> {
  const [u]: any = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (!u[0]) throw notFound('User not found');
  const authorId = BigInt(u[0].id);
  const [rows]: any = await pool.query(
    `SELECT s.*, u.username, u.display_name, pr.avatar_url,
            EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = ?) AS seen
     FROM stories s JOIN users u ON u.id = s.author_id LEFT JOIN profiles pr ON pr.user_id = s.author_id
     WHERE s.author_id = ? AND ${ACTIVE} ORDER BY s.id ASC`, [viewerId, authorId]);
  if (!rows.length) return null;
  const stories = rows.map((r: any) => toView(r));
  return {
    author: { username: rows[0].username, displayName: rows[0].display_name, avatarUrl: rows[0].avatar_url },
    stories,
    allSeen: stories.every((s: any) => s.seen),
    isSelf: authorId === viewerId,
  };
}

export async function markViewed(viewerId: bigint, storyId: number): Promise<void> {
  const [r]: any = await pool.query(
    `INSERT IGNORE INTO story_views (story_id, viewer_id)
     SELECT id, ? FROM stories WHERE id = ? AND ${ACTIVE}`, [viewerId, storyId]);
  if (r.affectedRows === 0 && !(await getStory(viewerId, storyId))) {
    throw notFound('Story not found or expired');
  }
}

export async function storyViewers(authorId: bigint, storyId: number): Promise<Array<{ username: string; displayName: string; viewedAt: string }>> {
  const [s]: any = await pool.query(`SELECT author_id FROM stories WHERE id = ? AND ${ACTIVE}`, [storyId]);
  if (!s[0]) throw notFound('Story not found');
  if (BigInt(s[0].author_id) !== authorId) throw forbidden('Only the author can see viewers');
  const [rows]: any = await pool.query(
    `SELECT u.username, u.display_name, v.viewed_at
     FROM story_views v JOIN users u ON u.id = v.viewer_id
     WHERE v.story_id = ? ORDER BY v.viewed_at DESC`, [storyId]);
  return rows.map((r: any) => ({ username: r.username, displayName: r.display_name, viewedAt: r.viewed_at }));
}

export async function deleteStory(userId: bigint, storyId: number): Promise<void> {
  const [s]: any = await pool.query('SELECT author_id FROM stories WHERE id = ? AND deleted_at IS NULL', [storyId]);
  if (!s[0]) throw notFound('Story not found');
  if (BigInt(s[0].author_id) !== userId) throw forbidden('Not your story');
  await pool.query('UPDATE stories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [storyId]);
}
