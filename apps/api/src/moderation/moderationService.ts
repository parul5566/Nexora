import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

export type ObjectType = 'post' | 'comment' | 'user' | 'community' | 'job' | 'message' | 'reel' | 'story';
export type ModAction = 'remove_content' | 'restore_content' | 'warn' | 'restrict' | 'suspend' | 'ban' | 'unban' | 'dismiss';

export interface ReportView {
  id: string;
  reporter: string;
  objectType: ObjectType;
  objectId: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface ActionView {
  id: string;
  moderator: string;
  action: ModAction;
  objectType: string | null;
  objectId: string | null;
  targetUser: string | null;
  note: string | null;
  createdAt: string;
}

/** Does this user hold a moderation role? */
export async function getRole(userId: bigint): Promise<'admin' | 'moderator' | null> {
  const [rows]: any = await pool.query('SELECT role FROM user_roles WHERE user_id = ?', [Number(userId)]);
  return (rows as any[])[0]?.role ?? null;
}

export async function requireModerator(userId: bigint): Promise<'admin' | 'moderator'> {
  const role = await getRole(userId);
  if (!role) throw forbidden('Moderator access required');
  return role;
}

export async function requireAdmin(userId: bigint): Promise<'admin'> {
  const role = await getRole(userId);
  if (role !== 'admin') throw forbidden('Admin access required');
  return role;
}

/** Any user can report any reportable object with a reason. */
export async function createReport(
  reporterId: bigint,
  objectType: ObjectType,
  objectId: number,
  reason: string,
): Promise<{ id: string; status: string }> {
  if (!reason.trim()) throw badRequest('A reason is required');
  // Verify the object exists (per type).
  const table: Record<ObjectType, string> = {
    post: 'posts', comment: 'comments', user: 'users', community: 'communities',
    job: 'jobs', message: 'messages', reel: 'reels', story: 'stories',
  };
  const [rows]: any = await pool.query(`SELECT id FROM ${table[objectType]} WHERE id = ?`, [objectId]);
  if (!(rows as any[]).length) throw notFound(`${objectType} not found`);
  // Duplicate reports coexist (dedupe on identical reporter+object+reason).
  const [dupe]: any = await pool.query(
    'SELECT id FROM reports WHERE reporter_id = ? AND object_type = ? AND object_id = ? AND reason = ?',
    [Number(reporterId), objectType, objectId, reason.trim()],
  );
  if ((dupe as any[]).length) return { id: String((dupe as any[])[0].id), status: 'open' };
  const [r]: any = await pool.query(
    'INSERT INTO reports (reporter_id, object_type, object_id, reason) VALUES (?,?,?,?)',
    [Number(reporterId), objectType, objectId, reason.trim()],
  );
  return { id: String(r.insertId), status: 'open' };
}

export async function listReports(status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open', limit = 50): Promise<ReportView[]> {
  const where = status === 'all' ? '' : 'WHERE r.status = ?';
  const args: unknown[] = status === 'all' ? [limit] : [status, limit];
  const [rows]: any = await pool.query(
    `SELECT r.id, u.username AS reporter, r.object_type, r.object_id, r.reason, r.status, r.created_at
     FROM reports r JOIN users u ON u.id = r.reporter_id
     ${where} ORDER BY r.id DESC LIMIT ?`,
    args,
  );
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    reporter: r.reporter,
    objectType: r.object_type,
    objectId: String(r.object_id),
    reason: r.reason,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

const CONTENT_TABLES: Partial<Record<ObjectType, string>> = {
  post: 'posts', comment: 'comments', reel: 'reels', story: 'stories',
};

/** Apply a moderator action. Every action is written to the audit trail. */
export async function act(
  moderatorId: bigint,
  reportId: number,
  action: ModAction,
  note?: string,
): Promise<{ ok: true; action: ModAction }> {
  const role = await requireModerator(moderatorId);
  const [reports]: any = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
  const report = (reports as any[])[0];
  if (!report) throw notFound('Report not found');
  if (report.status !== 'open') throw badRequest('Report already handled');

  let targetUserId: number | null = null;

  if (action === 'remove_content' || action === 'restore_content') {
    const table = CONTENT_TABLES[report.object_type as ObjectType];
    if (!table) throw badRequest(`Content removal not supported for ${report.object_type}`);
    const col = report.object_type === 'user' ? 'id' : 'id';
    // Verify object exists
    const [exists]: any = await pool.query(`SELECT id FROM ${table} WHERE ${col} = ?`, [report.object_id]);
    if (!(exists as any[]).length) throw notFound('Object not found');
    const val = action === 'remove_content' ? new Date() : null;
    await pool.query(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [val, report.object_id]);
    // record owner as target user for audit
    const [obj]: any = await pool.query(`SELECT ${report.object_type === 'comment' ? 'author_id' : report.object_type === 'reel' ? 'author_id' : report.object_type === 'story' ? 'author_id' : 'author_id'} AS owner FROM ${table} WHERE id = ?`, [report.object_id]);
    targetUserId = Number((obj as any[])[0]?.owner) || null;
  } else if (action === 'dismiss') {
    // no side effect beyond status
  } else {
    // warn / restrict / suspend / ban / unban apply to user-type reports
    if (report.object_type !== 'user') throw badRequest(`${action} applies to user reports only`);
    const [users]: any = await pool.query('SELECT id FROM users WHERE id = ?', [report.object_id]);
    if (!(users as any[]).length) throw notFound('User not found');
    targetUserId = Number(report.object_id);
    if (action === 'restrict') {
      await pool.query(`UPDATE users SET status = 'restricted' WHERE id = ?`, [targetUserId]);
    } else if (action === 'suspend') {
      await pool.query(`UPDATE users SET status = 'suspended' WHERE id = ?`, [targetUserId]);
    } else if (action === 'ban') {
      if (role !== 'admin') throw forbidden('Only admins can ban users');
      await pool.query(`UPDATE users SET status = 'banned' WHERE id = ?`, [targetUserId]);
    } else if (action === 'unban') {
      await pool.query(`UPDATE users SET status = 'active' WHERE id = ?`, [targetUserId]);
    } else if (action === 'warn') {
      // warning is recorded in the audit trail only
    }
  }

  await pool.query('UPDATE reports SET status = ? WHERE id = ?', [action === 'dismiss' ? 'dismissed' : 'resolved', reportId]);
  await pool.query(
    `INSERT INTO moderation_actions (moderator_id, report_id, action, object_type, object_id, target_user_id, note)
     VALUES (?,?,?,?,?,?,?)`,
    [Number(moderatorId), reportId, action, report.object_type, report.object_id, targetUserId, note ?? null],
  );
  return { ok: true, action };
}

/** Restore content directly by object (reverses a removal). */
export async function restoreObject(
  moderatorId: bigint,
  objectType: 'post' | 'comment' | 'reel' | 'story',
  objectId: number,
  note?: string,
): Promise<{ ok: true }> {
  const table = CONTENT_TABLES[objectType];
  if (!table) throw badRequest(`Restore not supported for ${objectType}`);
  const [rows]: any = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [objectId]);
  if (!(rows as any[]).length) throw notFound('Object not found');
  await pool.query(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`, [objectId]);
  const [obj]: any = await pool.query('SELECT author_id AS owner FROM ' + table + ' WHERE id = ?', [objectId]);
  await pool.query(
    `INSERT INTO moderation_actions (moderator_id, report_id, action, object_type, object_id, target_user_id, note)
     VALUES (?,?, 'restore_content', ?, ?, ?, ?)`,
    [Number(moderatorId), null, objectType, objectId, Number((obj as any[])[0]?.owner) || null, note ?? null],
  );
  return { ok: true };
}

export async function listAuditTrail(limit = 100): Promise<ActionView[]> {
  const [rows]: any = await pool.query(
    `SELECT a.id, m.username AS moderator, a.action, a.object_type, a.object_id,
            tu.username AS target_user, a.note, a.created_at
     FROM moderation_actions a
     JOIN users m ON m.id = a.moderator_id
     LEFT JOIN users tu ON tu.id = a.target_user_id
     ORDER BY a.id DESC LIMIT ?`,
    [limit],
  );
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    moderator: r.moderator,
    action: r.action,
    objectType: r.object_type,
    objectId: r.object_id != null ? String(r.object_id) : null,
    targetUser: r.target_user ?? null,
    note: r.note,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
