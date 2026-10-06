import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

export interface EventView {
  id: number;
  creator: string;
  title: string;
  description: string | null;
  privacy: 'public' | 'private';
  location: string | null;
  onlineUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  going: number;
  interested: number;
  myRsvp: string | null;
  isCreator: boolean;
}

function toView(row: RowDataPacket): EventView {
  const gated = !!Number(row.show_link_to_rsvps_only);
  return {
    id: Number(row.id),
    creator: row.creator_username,
    title: row.title,
    description: row.description ?? null,
    privacy: row.privacy,
    location: row.location ?? null,
    onlineUrl: gated && row.my_rsvp === null && !row.is_creator ? null : (row.online_url ?? null),
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    going: Number(row.going ?? 0),
    interested: Number(row.interested ?? 0),
    myRsvp: row.my_rsvp ?? null,
    isCreator: !!Number(row.is_creator ?? 0),
  };
}

const SELECT = `
  SELECT e.*, u.username AS creator_username,
    (e.creator_id = ?) AS is_creator,
    (SELECT status FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) AS my_rsvp,
    (SELECT COUNT(*) FROM event_rsvps r2 WHERE r2.event_id = e.id AND r2.status = 'going') AS going,
    (SELECT COUNT(*) FROM event_rsvps r3 WHERE r3.event_id = e.id AND r3.status = 'interested') AS interested
  FROM events e JOIN users u ON u.id = e.creator_id`;

async function isInvited(eventId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM event_invites WHERE event_id = ? AND invitee_id = ?', [eventId, userId]
  );
  return rows.length > 0;
}

/** Load event; enforce private-event access. Returns raw row. */
async function loadEvent(eventId: number, userId: number): Promise<RowDataPacket> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE e.id = ? AND e.deleted_at IS NULL`, [userId, userId, eventId]);
  if (rows.length === 0) throw notFound('Event not found');
  const row = rows[0];
  if (row.privacy === 'private' && !Number(row.is_creator) && !(await isInvited(eventId, userId))) {
    throw forbidden('This event is private');
  }
  return row;
}

export async function createEvent(userId: number, data: {
  title: string; description?: string; privacy?: 'public' | 'private'; location?: string;
  onlineUrl?: string; showLinkToRsvpsOnly?: boolean; startsAt: string; endsAt?: string;
}): Promise<EventView> {
  if (!data.title?.trim()) throw badRequest('Title is required');
  if (!data.startsAt || isNaN(Date.parse(data.startsAt))) throw badRequest('Valid startsAt is required');
  if (data.endsAt && isNaN(Date.parse(data.endsAt))) throw badRequest('Invalid endsAt');
  const startsAt = new Date(data.startsAt);
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO events (creator_id, title, description, privacy, location, online_url, show_link_to_rsvps_only, starts_at, ends_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, data.title.trim(), data.description ?? null, data.privacy ?? 'public', data.location ?? null,
      data.onlineUrl ?? null, data.showLinkToRsvpsOnly ? 1 : 0,
      startsAt.toISOString().slice(0, 19).replace('T', ' '), endsAt ? endsAt.toISOString().slice(0, 19).replace('T', ' ') : null]
  );
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE e.id = ?`, [userId, userId, res.insertId]);
  return toView(rows[0]);
}

export async function getEvent(eventId: number, userId: number): Promise<EventView> {
  return toView(await loadEvent(eventId, userId));
}

export async function listEvents(userId: number, opts: { limit?: number; cursor?: string } = {}): Promise<{ events: EventView[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const params: unknown[] = [userId, userId];
  let where = 'e.deleted_at IS NULL AND (e.privacy = \'public\' OR e.creator_id = ? OR EXISTS (SELECT 1 FROM event_invites ei WHERE ei.event_id = e.id AND ei.invitee_id = ?))';
  params.push(userId, userId);
  if (opts.cursor) { where += ' AND e.id < ?'; params.push(opts.cursor); }
  params.push(limit + 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT} WHERE ${where.replace('e.deleted_at IS NULL AND ', '')} ORDER BY e.starts_at ASC LIMIT ?`,
    params
  );
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map(toView);
  return { events, nextCursor: hasMore ? String(events[events.length - 1].id) : null };
}

export async function rsvp(userId: number, eventId: number, status: 'going' | 'interested' | 'not'): Promise<EventView> {
  await loadEvent(eventId, userId);
  await pool.query(
    `INSERT INTO event_rsvps (event_id, user_id, status) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [eventId, userId, status]
  );
  return getEvent(eventId, userId);
}

export async function invite(userId: number, eventId: number, inviteeUsername: string): Promise<{ invited: boolean }> {
  const row = await loadEvent(eventId, userId);
  if (!Number(row.is_creator) && row.privacy === 'private') throw forbidden('Only the creator invites to private events');
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [inviteeUsername]);
  if (u.length === 0) throw notFound('User not found');
  await pool.query('INSERT IGNORE INTO event_invites (event_id, inviter_id, invitee_id) VALUES (?,?,?)',
    [eventId, userId, Number(u[0].id)]);
  return { invited: true };
}

export async function listAttendees(userId: number, eventId: number): Promise<Array<{ username: string; displayName: string; status: string }>> {
  await loadEvent(eventId, userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.username, u.display_name, r.status FROM event_rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ? AND r.status != 'not' ORDER BY r.updated_at DESC`, [eventId]
  );
  return rows.map((r) => ({ username: r.username, displayName: r.display_name, status: r.status }));
}

export async function addComment(userId: number, eventId: number, text: string): Promise<Record<string, unknown>> {
  await loadEvent(eventId, userId);
  if (!text.trim()) throw badRequest('Comment text is required');
  const [res] = await pool.query<ResultSetHeader>(
    'INSERT INTO event_comments (event_id, user_id, text) VALUES (?,?,?)', [eventId, userId, text.trim()]
  );
  return { id: Number(res.insertId) };
}

export async function listComments(userId: number, eventId: number): Promise<Array<Record<string, unknown>>> {
  await loadEvent(eventId, userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.text, c.created_at, u.username, u.display_name
     FROM event_comments c JOIN users u ON u.id = c.user_id
     WHERE c.event_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at ASC`, [eventId]
  );
  return rows as unknown as Array<Record<string, unknown>>;
}

/** Fire reminders for events starting within 24h that haven't been reminded. Called lazily. */
export async function processReminders(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.title, e.starts_at FROM events e
     WHERE e.deleted_at IS NULL AND e.reminded_at IS NULL AND e.starts_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)`
  );
  let fired = 0;
  const { notify } = await import('../notifications/notificationService.js');
  for (const ev of rows) {
    const [attendees] = await pool.query<RowDataPacket[]>(
      "SELECT user_id FROM event_rsvps WHERE event_id = ? AND status = 'going'", [ev.id]
    );
    for (const a of attendees) {
      await notify(null, BigInt(a.user_id), 'mention', { eventId: String(ev.id), eventTitle: ev.title },
        `eventremind:${ev.id}:${a.user_id}`).catch(() => {});
      fired++;
    }
    await pool.query('UPDATE events SET reminded_at = NOW() WHERE id = ?', [ev.id]);
  }
  return fired;
}
