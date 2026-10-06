import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';
import { requireAdmin, listAuditTrail } from '../moderation/moderationService.js';

export type AdminCapability =
  | 'manage_users' | 'manage_content' | 'view_reports' | 'moderate'
  | 'manage_communities' | 'manage_companies' | 'manage_jobs' | 'view_analytics' | 'manage_admins';

/** Capability sets per admin tier. 'super' = full; 'limited' = read-only + content. */
const SUPER_CAPS: Set<AdminCapability> = new Set([
  'manage_users', 'manage_content', 'view_reports', 'moderate',
  'manage_communities', 'manage_companies', 'manage_jobs', 'view_analytics', 'manage_admins',
]);
const LIMITED_CAPS: Set<AdminCapability> = new Set([
  'view_reports', 'moderate', 'view_analytics',
]);

export async function getAdminTier(userId: bigint): Promise<'super' | 'limited' | null> {
  const [rows]: any = await pool.query('SELECT role FROM user_roles WHERE user_id = ?', [Number(userId)]);
  const role = (rows as any[])[0]?.role;
  if (role === 'admin') return 'super';
  if (role === 'moderator') return 'limited';
  return null;
}

export async function requireCapability(userId: bigint, cap: AdminCapability): Promise<void> {
  const tier = await getAdminTier(userId);
  if (!tier) throw forbidden('Admin access required');
  const caps = tier === 'super' ? SUPER_CAPS : LIMITED_CAPS;
  if (!caps.has(cap)) throw forbidden(`Your admin role does not permit ${cap}`);
}

export interface AdminUserView {
  id: string;
  username: string;
  email: string;
  status: string;
  createdAt: string;
  followers: number;
}

export async function searchUsers(query: string, limit = 30): Promise<AdminUserView[]> {
  const like = `%${query}%`;
  const [rows]: any = await pool.query(
    `SELECT u.id, u.username, u.email, u.status, u.created_at,
            (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers
     FROM users u
     WHERE u.username LIKE ? OR u.email LIKE ?
     ORDER BY u.id DESC LIMIT ?`,
    [like, like, limit],
  );
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    username: r.username,
    email: r.email,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    followers: Number(r.followers),
  }));
}

export async function setUserStatus(
  adminId: bigint,
  targetUserId: number,
  status: 'active' | 'restricted' | 'suspended' | 'banned',
): Promise<{ ok: true }> {
  await requireCapability(adminId, 'manage_users');
  const [rows]: any = await pool.query('SELECT id FROM users WHERE id = ?', [targetUserId]);
  if (!(rows as any[]).length) throw notFound('User not found');
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, targetUserId]);
  await pool.query(
    `INSERT INTO moderation_actions (moderator_id, action, target_user_id, note) VALUES (?, ?, ?, ?)`,
    [Number(adminId),
     status === 'active' ? 'unban' : status === 'restricted' ? 'restrict' : status === 'suspended' ? 'suspend' : 'ban',
     targetUserId, `admin: set status ${status}`],
  );
  return { ok: true };
}

export interface AdminContentView {
  id: string;
  author: string;
  excerpt: string;
  deleted: boolean;
  createdAt: string;
}

export async function listContent(type: 'post' | 'reel' | 'comment', limit = 30): Promise<AdminContentView[]> {
  const table = type === 'post' ? 'posts' : type === 'reel' ? 'reels' : 'comments';
  const textCol = type === 'reel' ? 'caption' : 'content';
  const [rows]: any = await pool.query(
    `SELECT c.id, u.username AS author, c.${textCol} AS text, c.deleted_at, c.created_at
     FROM ${table} c JOIN users u ON u.id = c.author_id
     ORDER BY c.id DESC LIMIT ?`,
    [limit],
  );
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    author: r.author,
    excerpt: String(r.text ?? '').slice(0, 120),
    deleted: !!r.deleted_at,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function adminEditContent(
  adminId: bigint,
  type: 'post' | 'reel' | 'comment',
  objectId: number,
  action: 'remove' | 'restore' | 'edit',
  newText?: string,
): Promise<{ ok: true }> {
  await requireCapability(adminId, 'manage_content');
  const table = type === 'post' ? 'posts' : type === 'reel' ? 'reels' : 'comments';
  const textCol = type === 'reel' ? 'caption' : 'content';
  const [rows]: any = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [objectId]);
  if (!(rows as any[]).length) throw notFound(`${type} not found`);
  if (action === 'remove') {
    await pool.query(`UPDATE ${table} SET deleted_at = NOW() WHERE id = ?`, [objectId]);
  } else if (action === 'restore') {
    await pool.query(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`, [objectId]);
  } else {
    if (!newText?.trim()) throw badRequest('New text required for edit');
    await pool.query(`UPDATE ${table} SET ${textCol} = ? WHERE id = ?`, [newText.trim(), objectId]);
  }
  await pool.query(
    `INSERT INTO moderation_actions (moderator_id, action, object_type, object_id, note) VALUES (?, ?, ?, ?, ?)`,
    [Number(adminId), action === 'remove' ? 'remove_content' : action === 'restore' ? 'restore_content' : 'warn',
     type, objectId, `admin content ${action}`],
  );
  return { ok: true };
}

export interface PlatformAnalytics {
  users: number;
  posts: number;
  comments: number;
  reactions: number;
  follows: number;
  connections: number;
  messages: number;
  communities: number;
  companies: number;
  jobs: number;
  events: number;
  reels: number;
  stories: number;
  openReports: number;
  bannedUsers: number;
  dau: number;
  mau: number;
  watchTimeSeconds: number;
  shares: number;
  saves: number;
  retention: { day1: number; day7: number; day30: number };
}

export async function platformAnalytics(): Promise<PlatformAnalytics> {
  const one = async (sql: string): Promise<number> => {
    const [rows]: any = await pool.query(sql);
    return Number(Object.values((rows as any[])[0] ?? {})[0] ?? 0);
  };
  // DAU: distinct users with an active (non-revoked, non-expired) session created in last 24h
  const dau = await one(
    `SELECT COUNT(DISTINCT s.user_id) AS c FROM sessions s
     WHERE s.revoked_at IS NULL AND s.expires_at > NOW() AND s.created_at >= NOW() - INTERVAL 1 DAY`
  );
  const mau = await one(
    `SELECT COUNT(DISTINCT s.user_id) AS c FROM sessions s
     WHERE s.revoked_at IS NULL AND s.expires_at > NOW() AND s.created_at >= NOW() - INTERVAL 30 DAY`
  );
  // Retention: of users who signed up in a cohort day, fraction active (new session) N days later
  const retention = async (intervalDays: number): Promise<number> => {
    const [rows]: any = await pool.query(
      `SELECT
        (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.created_at >= NOW() - INTERVAL ? DAY - INTERVAL 1 DAY AND u.created_at < NOW() - INTERVAL ? DAY) AS cohort,
        (SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u2 ON u2.id = s.user_id
          WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
            AND u2.created_at >= NOW() - INTERVAL ? DAY - INTERVAL 1 DAY AND u2.created_at < NOW() - INTERVAL ? DAY
            AND s.created_at >= u2.created_at + INTERVAL ? DAY) AS retained,
        (SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u3 ON u3.id = s.user_id
          WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
            AND u3.created_at >= NOW() - INTERVAL ? DAY - INTERVAL 1 DAY AND u3.created_at < NOW() - INTERVAL ? DAY) AS ever_active`,
      [intervalDays, intervalDays, intervalDays, intervalDays, intervalDays, intervalDays, intervalDays]
    );
    const r = (rows as any[])[0] ?? {};
    const denom = Number(r.cohort ?? 0);
    if (!denom) return 0;
    const retained = Math.max(Number(r.retained ?? 0), 0);
    const everActive = Math.max(Number(r.ever_active ?? 1), 1);
    // retention among users who were active at all (avoids counting never-activated signups)
    return Math.round((Math.min(retained, everActive) / everActive) * 100);
  };
  return {
    users: await one('SELECT COUNT(*) AS c FROM users'),
    posts: await one('SELECT COUNT(*) AS c FROM posts WHERE deleted_at IS NULL'),
    comments: await one('SELECT COUNT(*) AS c FROM comments WHERE deleted_at IS NULL'),
    reactions: await one('SELECT COUNT(*) AS c FROM reactions'),
    follows: await one('SELECT COUNT(*) AS c FROM follows'),
    connections: await one("SELECT COUNT(*) AS c FROM connection_requests WHERE status = 'accepted'"),
    messages: await one('SELECT COUNT(*) AS c FROM messages WHERE deleted_at IS NULL'),
    communities: await one('SELECT COUNT(*) AS c FROM communities'),
    companies: await one('SELECT COUNT(*) AS c FROM companies'),
    jobs: await one('SELECT COUNT(*) AS c FROM jobs'),
    events: await one('SELECT COUNT(*) AS c FROM events'),
    reels: await one('SELECT COUNT(*) AS c FROM reels WHERE deleted_at IS NULL'),
    stories: await one('SELECT COUNT(*) AS c FROM stories WHERE deleted_at IS NULL'),
    openReports: await one("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"),
    bannedUsers: await one("SELECT COUNT(*) AS c FROM users WHERE status = 'banned'"),
    dau,
    mau,
    watchTimeSeconds: await one('SELECT COALESCE(SUM(seconds),0) AS c FROM reel_watch_events'),
    shares: await one('SELECT COUNT(*) AS c FROM posts WHERE deleted_at IS NULL AND link_url IS NOT NULL'),
    saves: await one('SELECT COUNT(*) AS c FROM bookmarks'),
    retention: {
      day1: await retention(1),
      day7: await retention(7),
      day30: await retention(30),
    },
  };
}

export { listAuditTrail as auditLog };
