import { pool } from '../db/database.js';

export type NotificationType =
  | 'reaction' | 'comment' | 'reply' | 'follow'
  | 'connection_request' | 'connection_accept' | 'mention';

export interface NotificationView {
  id: string;
  type: NotificationType;
  actor: { username: string; displayName: string; avatarUrl: string | null } | null;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

/** Create a notification; silently skips self-notifications and duplicates. */
export async function notify(
  actorId: bigint | null,
  recipientId: bigint,
  type: NotificationType,
  payload: Record<string, unknown> = {},
  dedupeKey?: string,
): Promise<void> {
  if (actorId !== null && actorId === recipientId) return; // never self-notify
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, payload, dedupe_key)
       VALUES (?, ?, ?, ?, ?)
       ${dedupeKey ? 'ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP, read_at = NULL' : ''}`,
      [recipientId, actorId, type, JSON.stringify(payload), dedupeKey ?? null],
    );
  } catch {
    // duplicate dedupe_key without ON DUPLICATE (race) — ignore
  }
}

export async function listNotifications(
  userId: bigint,
  opts: { cursor: string | null; limit: number; type?: string | null },
): Promise<{ notifications: NotificationView[]; nextCursor: string | null; unread: number }> {
  const l = Math.min(Math.max(1, opts.limit), 50);
  const params: unknown[] = [userId, l + 1];
  let cursorSql = '';
  if (opts.cursor) { cursorSql = ' AND n.id < ?'; params.splice(1, 0, BigInt(opts.cursor)); }
  let typeSql = '';
  if (opts.type === 'likes') {
    typeSql = " AND n.type = 'reaction'";
  } else if (opts.type === 'comments') {
    typeSql = " AND n.type IN ('comment','reply')";
  } else if (opts.type === 'mentions') {
    typeSql = " AND n.type = 'mention'";
  } else if (opts.type === 'follows') {
    typeSql = " AND n.type IN ('follow','connection_request','connection_accept')";
  }
  const [rows]: any = await pool.query(
    `SELECT n.*, u.username, u.display_name, pr.avatar_url
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     LEFT JOIN profiles pr ON pr.user_id = n.actor_id
     WHERE n.user_id = ? ${cursorSql} ${typeSql}
     ORDER BY n.id DESC LIMIT ?`, params);
  const hasMore = rows.length > l;
  const page = rows.slice(0, l);
  const [unreadRow]: any = await pool.query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return {
    notifications: page.map((r: any) => ({
      id: String(r.id),
      type: r.type,
      actor: r.username
        ? { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }
        : null,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload ?? {}),
      read: r.read_at !== null,
      createdAt: r.created_at,
    })),
    nextCursor: hasMore && page.length ? String(page[page.length - 1].id) : null,
    unread: Number(unreadRow[0].c),
  };
}

export async function unreadCount(userId: bigint): Promise<number> {
  const [r]: any = await pool.query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return Number(r[0].c);
}

export async function markRead(userId: bigint, ids: string[] | null): Promise<number> {
  if (ids === null) {
    const [r]: any = await pool.query(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL', [userId]);
    return r.affectedRows;
  }
  if (!ids.length) return 0;
  const [r]: any = await pool.query(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL AND id IN (?)',
    [userId, ids.map(Number)]);
  return r.affectedRows;
}
