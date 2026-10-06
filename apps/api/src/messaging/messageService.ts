import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

export interface MessageView {
  id: string;
  conversationId: string;
  sender: { username: string; displayName: string; avatarUrl: string | null };
  content: string;
  createdAt: string;
}

export async function getOrCreateConversation(userId: bigint, otherUsername: string): Promise<{ id: string }> {
  const [other]: any = await pool.query('SELECT id FROM users WHERE username = ?', [otherUsername]);
  if (!other[0]) throw notFound('User not found');
  const otherId = BigInt(other[0].id);
  if (otherId === userId) throw badRequest('Cannot message yourself');

  const [existing]: any = await pool.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
     JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
     LIMIT 1`, [userId, otherId]);
  if (existing[0]) return { id: String(existing[0].id) };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r]: any = await conn.query('INSERT INTO conversations (created_by) VALUES (?)', [userId]);
    const convId = r.insertId;
    await conn.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [convId, userId, convId, otherId]);
    await conn.commit();
    return { id: String(convId) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function assertParticipant(userId: bigint, conversationId: number): Promise<void> {
  const [p]: any = await pool.query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]);
  if (!p[0]) throw forbidden('Not a participant of this conversation');
}

export async function sendMessage(userId: bigint, conversationId: number, content: string): Promise<MessageView> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 5000) throw badRequest('Message must be 1–5000 characters');
  await assertParticipant(userId, conversationId);
  const [r]: any = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)',
    [conversationId, userId, trimmed]);
  return (await getMessage(userId, Number(r.insertId)))!;
}

export async function getMessage(userId: bigint, messageId: number): Promise<MessageView | null> {
  const [rows]: any = await pool.query(
    `SELECT m.*, u.username, u.display_name, pr.avatar_url
     FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN profiles pr ON pr.user_id = m.sender_id
     WHERE m.id = ? AND m.deleted_at IS NULL`, [messageId]);
  if (!rows[0]) return null;
  await assertParticipant(userId, Number(rows[0].conversation_id));
  return toView(rows[0]);
}

function toView(r: any): MessageView {
  return {
    id: String(r.id),
    conversationId: String(r.conversation_id),
    sender: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
    content: r.content,
    createdAt: r.created_at,
  };
}

export async function listMessages(
  userId: bigint,
  conversationId: number,
  opts: { cursor: string | null; limit: number },
): Promise<{ messages: MessageView[]; nextCursor: string | null }> {
  await assertParticipant(userId, conversationId);
  const l = Math.min(Math.max(1, opts.limit), 100);
  const params: unknown[] = [conversationId, l + 1];
  let cursorSql = '';
  if (opts.cursor) { cursorSql = ' AND m.id < ?'; params.splice(1, 0, BigInt(opts.cursor)); }
  const [rows]: any = await pool.query(
    `SELECT m.*, u.username, u.display_name, pr.avatar_url
     FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN profiles pr ON pr.user_id = m.sender_id
     WHERE m.conversation_id = ? AND m.deleted_at IS NULL ${cursorSql}
     ORDER BY m.id DESC LIMIT ?`, params);
  const hasMore = rows.length > l;
  const page = rows.slice(0, l);
  await pool.query(
    'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]);
  return {
    messages: page.map(toView),
    nextCursor: hasMore && page.length ? String(page[page.length - 1].id) : null,
  };
}

export async function listConversations(userId: bigint): Promise<Array<{
  id: string; other: { username: string; displayName: string; avatarUrl: string | null };
  lastMessage: string | null; lastMessageAt: string | null; unread: number;
}>> {
  const [convs]: any = await pool.query(
    'SELECT conversation_id FROM conversation_participants WHERE user_id = ?', [userId]);
  const out = [];
  for (const c of convs) {
    const [others]: any = await pool.query(
      `SELECT u.username, u.display_name, pr.avatar_url
       FROM conversation_participants cp JOIN users u ON u.id = cp.user_id LEFT JOIN profiles pr ON pr.user_id = cp.user_id
       WHERE cp.conversation_id = ? AND cp.user_id != ?`, [c.conversation_id, userId]);
    const [last]: any = await pool.query(
      `SELECT content, created_at FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
      [c.conversation_id]);
    const [unread]: any = await pool.query(
      `SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ? AND deleted_at IS NULL
         AND created_at > COALESCE((SELECT last_read_at FROM conversation_participants WHERE conversation_id = ? AND user_id = ?), '1970-01-01')`,
      [c.conversation_id, c.conversation_id, userId]);
    out.push({
      id: String(c.conversation_id),
      other: others[0] ? { username: others[0].username, displayName: others[0].display_name, avatarUrl: others[0].avatar_url } : { username: 'unknown', displayName: 'Unknown', avatarUrl: null },
      lastMessage: last[0]?.content ?? null,
      lastMessageAt: last[0]?.created_at ?? null,
      unread: Number(unread[0]?.c ?? 0),
    });
  }
  out.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return out;
}
