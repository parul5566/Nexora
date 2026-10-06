import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

export interface CommunityView {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'public' | 'private';
  rules: unknown;
  memberCount: number;
  creatorId: number;
  myRole: string | null;
  createdAt: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function toView(row: RowDataPacket): CommunityView {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    privacy: row.privacy,
    rules: row.rules ? (typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules) : null,
    memberCount: Number(row.member_count ?? 0),
    creatorId: Number(row.creator_id),
    myRole: row.my_role ?? null,
    createdAt: row.created_at,
  };
}

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export async function createCommunity(userId: number, data: {
  name: string; description?: string; privacy?: 'public' | 'private'; rules?: unknown;
}): Promise<CommunityView> {
  let slug = slugify(data.name);
  if (!slug) throw badRequest('Community name must contain letters or numbers');
  const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM communities WHERE slug = ?', [slug]);
  if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      'INSERT INTO communities (name, slug, description, privacy, rules, creator_id, member_count) VALUES (?,?,?,?,?,?,1)',
      [data.name, slug, data.description ?? null, data.privacy ?? 'public',
        data.rules ? JSON.stringify(data.rules) : null, userId]
    );
    await conn.query(
      'INSERT INTO community_members (community_id, user_id, role) VALUES (?,?,?)',
      [res.insertId, userId, 'owner']
    );
    await conn.commit();
    return await getCommunityBySlug(slug, userId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getCommunityBySlug(slug: string, viewerId: number): Promise<CommunityView> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, m.role AS my_role FROM communities c
     LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = ?
     WHERE c.slug = ?`, [viewerId, slug]
  );
  if (rows.length === 0) throw notFound('Community not found');
  return toView(rows[0]);
}

export async function updateCommunity(userId: number, slug: string, data: {
  description?: string; rules?: unknown;
}): Promise<CommunityView> {
  const community = await getCommunityBySlug(slug, userId);
  requireRole(community.myRole, ['owner', 'admin']);
  await pool.query('UPDATE communities SET description = COALESCE(?, description), rules = COALESCE(?, rules) WHERE id = ?', [
    data.description ?? null, data.rules ? JSON.stringify(data.rules) : null, community.id,
  ]);
  return getCommunityBySlug(slug, userId);
}

export function requireRole(role: string | null, allowed: CommunityRole[]): void {
  if (!role || !allowed.includes(role as CommunityRole)) {
    throw forbidden('Insufficient community role');
  }
}

export async function joinCommunity(userId: number, slug: string): Promise<CommunityView> {
  const community = await getCommunityBySlug(slug, userId);
  await pool.query(
    'INSERT IGNORE INTO community_members (community_id, user_id, role) VALUES (?,?,?)',
    [community.id, userId, 'member']
  );
  await pool.query(
    'UPDATE communities SET member_count = (SELECT COUNT(*) FROM community_members WHERE community_id = ?) WHERE id = ?',
    [community.id, community.id]
  );
  return getCommunityBySlug(slug, userId);
}

export async function leaveCommunity(userId: number, slug: string): Promise<{ left: boolean }> {
  const community = await getCommunityBySlug(slug, userId);
  if (community.myRole === 'owner') throw badRequest('Owner cannot leave — transfer or delete the community first');
  const [res] = await pool.query<ResultSetHeader>(
    'DELETE FROM community_members WHERE community_id = ? AND user_id = ?', [community.id, userId]
  );
  await pool.query(
    'UPDATE communities SET member_count = (SELECT COUNT(*) FROM community_members WHERE community_id = ?) WHERE id = ?',
    [community.id, community.id]
  );
  return { left: res.affectedRows > 0 };
}

export async function inviteMember(userId: number, slug: string, inviteeUsername: string): Promise<{ invited: boolean }> {
  const community = await getCommunityBySlug(slug, userId);
  requireRole(community.myRole, ['owner', 'admin', 'moderator']);
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [inviteeUsername]);
  if (u.length === 0) throw notFound('User not found');
  const inviteeId = Number(u[0].id);
  await pool.query(
    `INSERT INTO community_invites (community_id, inviter_id, invitee_id, status)
     VALUES (?,?,?,'pending') ON DUPLICATE KEY UPDATE status = 'pending'`,
    [community.id, userId, inviteeId]
  );
  return { invited: true };
}

export async function acceptInvite(userId: number, slug: string): Promise<CommunityView> {
  const community = await getCommunityBySlug(slug, userId);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE community_invites SET status = 'accepted'
     WHERE community_id = ? AND invitee_id = ? AND status = 'pending'`, [community.id, userId]
  );
  if (res.affectedRows === 0) throw notFound('No pending invite');
  await joinCommunity(userId, slug);
  return getCommunityBySlug(slug, userId);
}

export async function setMemberRole(actorId: number, slug: string, targetUsername: string, role: CommunityRole): Promise<{ updated: boolean }> {
  const community = await getCommunityBySlug(slug, actorId);
  if (community.myRole !== 'owner') throw forbidden('Only the owner assigns roles');
  if (role === 'owner') throw badRequest('Ownership transfer is not allowed via this endpoint');
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [targetUsername]);
  if (u.length === 0) throw notFound('User not found');
  const [res] = await pool.query<ResultSetHeader>(
    'UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?',
    [role, community.id, Number(u[0].id)]
  );
  if (res.affectedRows === 0) throw notFound('User is not a member');
  return { updated: true };
}

export async function listMembers(slug: string, viewerId: number): Promise<Array<{ username: string; displayName: string; role: string }>> {
  const community = await getCommunityBySlug(slug, viewerId);
  if (community.privacy === 'private') {
    requireRole(community.myRole, ['owner', 'admin', 'moderator', 'member']);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.username, u.display_name, m.role FROM community_members m
     JOIN users u ON u.id = m.user_id WHERE m.community_id = ? ORDER BY FIELD(m.role,'owner','admin','moderator','member'), m.created_at`,
    [community.id]
  );
  return rows.map((r) => ({ username: r.username, displayName: r.display_name, role: r.role }));
}

export async function listCommunities(viewerId: number, opts: { search?: string; limit?: number; cursor?: string } = {}): Promise<{ communities: CommunityView[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const params: unknown[] = [];
  let where = "c.privacy = 'public'";
  if (opts.search) {
    where += ' AND (c.name LIKE ? OR c.slug LIKE ?)';
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.cursor) params.push(opts.cursor);
  params.push(limit + 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, m.role AS my_role FROM communities c
     LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = ?
     WHERE ${where} ORDER BY c.id DESC LIMIT ?`,
    [viewerId, ...params]
  );
  const hasMore = rows.length > limit;
  const communities = rows.slice(0, limit).map(toView);
  return { communities, nextCursor: hasMore ? String(communities[communities.length - 1].id) : null };
}

export async function getMembership(userId: number, communityId: number): Promise<{ role: string } | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT role FROM community_members WHERE community_id = ? AND user_id = ?', [communityId, userId]
  );
  return rows.length > 0 ? { role: rows[0].role } : null;
}

export async function listCommunityPosts(community: CommunityView, viewerId: number, opts: { limit?: number; cursor?: string } = {}): Promise<{ posts: RowDataPacket[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const params: unknown[] = [community.id];
  let cursorClause = '';
  if (opts.cursor) {
    cursorClause = ' AND (p.pinned_at IS NOT NULL AND p.id <= ? OR p.pinned_at IS NULL AND p.id < ?)';
    params.push(opts.cursor, opts.cursor);
  }
  params.push(viewerId, viewerId, viewerId, limit + 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, u.username, u.display_name,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.community_id = ? AND p.is_draft = 0 AND p.deleted_at IS NULL${cursorClause}
     ORDER BY pinned_at IS NULL ASC, pinned_at DESC, p.id DESC LIMIT ?`,
    params
  );
  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);
  return { posts, nextCursor: hasMore ? String(posts[posts.length - 1].id) : null };
}
