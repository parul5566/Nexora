import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/database.js';
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from '@nexora/shared';
import { badRequest, conflict, unauthorized, notFound, forbidden } from '@nexora/shared';
import { logger } from '../logger.js';

const SESSION_TTL_DAYS = 30;
const EMAIL_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_HOURS = 1;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Dev-only plaintext token registry backing the dev-verification-token
 * endpoint (stand-in for real email delivery). Kept in-memory, capped.
 */
const devTokens: Array<{ email: string; purpose: string; token: string }> = [];

export function lastTokenFor(email: string, purpose: string): string | null {
  const found = [...devTokens].reverse().find((t) => t.email === email && t.purpose === purpose);
  return found?.token ?? null;
}

function recordDevToken(email: string, purpose: string, token: string) {
  devTokens.push({ email, purpose, token });
  if (devTokens.length > 500) devTokens.shift();
}

interface UserRow {
  id: number | bigint;
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
  status?: string;
}

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date;
}

function toSafeUser(row: UserRow): SafeUser {
  return {
    id: String(row.id),
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    emailVerified: !!row.email_verified_at,
    createdAt: row.created_at,
  };
}

async function insertUser(input: RegisterInput): Promise<UserRow> {
  const hash = await bcrypt.hash(input.password, 12);
  try {
    const [r]: any = await pool.query(
      'INSERT INTO users (email, username, display_name, password_hash) VALUES (?, ?, ?, ?)',
      [input.email, input.username, input.displayName, hash],
    );
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
    return rows[0];
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      const [rows]: any = await pool.query(
        'SELECT email, username FROM users WHERE email = ? OR username = ? LIMIT 1',
        [input.email, input.username],
      );
      const dup = rows[0];
      if (dup?.email === input.email) throw conflict('An account with this email already exists');
      throw conflict('This username is already taken');
    }
    throw err;
  }
}

async function createVerificationToken(userId: number | bigint, purpose: 'email_verify' | 'password_reset'): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const ttlHours = purpose === 'email_verify' ? EMAIL_TOKEN_TTL_HOURS : RESET_TOKEN_TTL_HOURS;
  await pool.query(
    'INSERT INTO verification_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
    [userId, purpose, sha256(token), ttlHours],
  );
  return token;
}

class LogMailTransport {
  async send(to: string, subject: string, body: string): Promise<void> {
    logger.info('email (log transport)', { to, subject, body });
  }
}
const mailer = new LogMailTransport();

export async function register(raw: unknown): Promise<{ user: SafeUser; verifyToken?: string }> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid registration data');
  const user = await insertUser(parsed.data);
  const verifyToken = await createVerificationToken(user.id, 'email_verify');
  await mailer.send(user.email, 'Verify your Bhasebook account', `Your verification token: ${verifyToken}`);
  recordDevToken(user.email, 'email_verify', verifyToken);
  // The token travels in the response only while no real mail provider is
  // configured (dev transport). Once REAL_MAIL=1, clients must use email.
  const exposeDevToken = process.env.REAL_MAIL !== '1';
  return { user: toSafeUser(user), verifyToken: exposeDevToken ? verifyToken : undefined };
}

export async function verifyEmail(token: string): Promise<void> {
  const [rows]: any = await pool.query(
    `SELECT vt.*, u.email FROM verification_tokens vt JOIN users u ON u.id = vt.user_id
     WHERE vt.token_hash = ? AND vt.purpose = 'email_verify' AND vt.used_at IS NULL AND vt.expires_at > NOW()`,
    [sha256(token)],
  );
  if (!rows.length) throw badRequest('Invalid or expired verification token');
  const t = rows[0];
  await pool.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [t.user_id]);
  await pool.query('UPDATE verification_tokens SET used_at = NOW() WHERE id = ?', [t.id]);
}

export async function login(raw: unknown, userAgent?: string, ip?: string): Promise<{ user: SafeUser; token: string; sessionId?: string }> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw unauthorized('Invalid email or password');
  const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [parsed.data.email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(parsed.data.password, user.password_hash));
  if (!ok) throw unauthorized('Invalid email or password');
  if (!user.email_verified_at) throw unauthorized('Please verify your email before logging in');
  if (user.status === 'banned') throw forbidden('This account has been banned');
  if (user.status === 'suspended') throw forbidden('This account is suspended');

  const token = crypto.randomBytes(32).toString('hex');
  const [r]: any = await pool.query(
    'INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at) VALUES (UUID(), ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [user.id, sha256(token), userAgent ?? null, ip ?? null, SESSION_TTL_DAYS],
  );
  const [srows]: any = await pool.query('SELECT id FROM sessions WHERE token_hash = ?', [sha256(token)]);
  const sessionId = srows[0]?.id;
  void r;
  return { user: toSafeUser(user), token, sessionId };
}

export async function logout(token: string): Promise<void> {
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = ?', [sha256(token)]);
}

export interface AuthContext {
  userId: bigint;
  sessionId: string;
  username: string;
}

export async function requireSession(token: string | undefined): Promise<AuthContext> {
  if (!token) throw unauthorized();
  const [rows]: any = await pool.query(
    `SELECT s.id, s.user_id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [sha256(token)],
  );
  if (!rows.length) throw unauthorized('Session invalid or expired');
  return { userId: BigInt(rows[0].user_id), sessionId: rows[0].id, username: rows[0].username };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const [rows]: any = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
  if (!rows.length) return; // do not reveal account existence
  const token = await createVerificationToken(rows[0].id, 'password_reset');
  await mailer.send(rows[0].email, 'Reset your Bhasebook password', `Your password reset token: ${token}`);
  recordDevToken(rows[0].email, 'password_reset', token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const parsed = (await import('@nexora/shared')).passwordSchema.safeParse(newPassword);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid password');
  const [rows]: any = await pool.query(
    `SELECT * FROM verification_tokens
     WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > NOW()`,
    [sha256(token)],
  );
  if (!rows.length) throw badRequest('Invalid or expired reset token');
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
  await pool.query('UPDATE verification_tokens SET used_at = NOW() WHERE id = ?', [rows[0].id]);
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = ?', [rows[0].user_id]);
}

export async function changePassword(ctx: AuthContext, currentPassword: string, newPassword: string): Promise<void> {
  const [rows]: any = await pool.query('SELECT password_hash FROM users WHERE id = ?', [ctx.userId]);
  if (!rows.length) throw notFound('User not found');
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw unauthorized('Current password is incorrect');
  const parsed = (await import('@nexora/shared')).passwordSchema.safeParse(newPassword);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid password');
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, ctx.userId]);
}

export async function listSessions(ctx: AuthContext) {
  const [rows]: any = await pool.query(
    'SELECT id, user_agent, ip, created_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC',
    [ctx.userId],
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    userAgent: r.user_agent,
    ip: r.ip,
    createdAt: r.created_at,
    current: r.id === ctx.sessionId,
  }));
}

export async function revokeSession(ctx: AuthContext, sessionId: string): Promise<void> {
  const [rows]: any = await pool.query('SELECT user_id FROM sessions WHERE id = ?', [sessionId]);
  if (!rows.length || BigInt(rows[0].user_id) !== ctx.userId) throw notFound('Session not found');
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE id = ?', [sessionId]);
}

export async function getUserById(id: bigint | string): Promise<SafeUser> {
  const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw notFound('User not found');
  return toSafeUser(rows[0]);
}
