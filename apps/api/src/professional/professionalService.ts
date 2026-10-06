import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

type Section = 'experiences' | 'education' | 'skills' | 'certifications' | 'projects';

const TABLES: Record<Exclude<Section, 'skills'>, string> = {
  experiences: 'professional_experiences',
  education: 'professional_education',
  certifications: 'certifications',
  projects: 'projects',
};

function assertOwner(userId: number, table: string, id: number, column = 'user_id'): void {
  // enforced by caller through WHERE user_id = ? on every write
  void userId; void table; void id; void column;
}

export async function addSectionEntry(userId: number, section: Section, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (section === 'skills') {
    const name = String(data.name ?? '').trim().slice(0, 80);
    if (!name) throw badRequest('Skill name is required');
    await pool.query('INSERT IGNORE INTO skills (user_id, name) VALUES (?, ?)', [userId, name]);
    return { name };
  }
  const table = TABLES[section as Exclude<Section, 'skills'>];
  const cols: string[] = ['user_id'];
  const vals: unknown[] = [userId];
  const allowed: Record<string, unknown> = data;
  for (const [key, value] of Object.entries(allowed)) {
    if (key === 'id' || key === 'user_id' || key === 'created_at') continue;
    cols.push(key);
    vals.push(value);
  }
  if (cols.length < 2) throw badRequest('No fields provided');
  const placeholders = cols.map(() => '?').join(', ');
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, vals
  );
  return { id: Number(res.insertId), ...data };
}

export async function updateSectionEntry(userId: number, section: Section, id: number, data: Record<string, unknown>): Promise<void> {
  if (section === 'skills') throw badRequest('Skills cannot be edited — remove and re-add');
  const table = TABLES[section as Exclude<Section, 'skills'>];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' || key === 'user_id' || key === 'created_at') continue;
    sets.push(`${key} = ?`);
    vals.push(value);
  }
  if (sets.length === 0) throw badRequest('No fields to update');
  vals.push(userId, id);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, vals
  );
  if (res.affectedRows === 0) throw notFound('Entry not found');
}

export async function removeSectionEntry(userId: number, section: Section, id: number): Promise<void> {
  if (section === 'skills') {
    const [res] = await pool.query<ResultSetHeader>(
      'DELETE FROM skills WHERE user_id = ? AND id = ?', [userId, id]
    );
    if (res.affectedRows === 0) throw notFound('Skill not found');
    return;
  }
  const table = TABLES[section as Exclude<Section, 'skills'>];
  const [res] = await pool.query<ResultSetHeader>(
    `DELETE FROM ${table} WHERE user_id = ? AND id = ?`, [userId, id]
  );
  if (res.affectedRows === 0) throw notFound('Entry not found');
}

export async function listSection(userId: number, section: Section): Promise<Array<Record<string, unknown>>> {
  if (section === 'skills') {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name FROM skills WHERE user_id = ? ORDER BY created_at', [userId]
    );
    return rows as unknown as Array<Record<string, unknown>>;
  }
  const table = TABLES[section as Exclude<Section, 'skills'>];
  const hasDates = table !== 'certifications' ? true : true; // all four tables have start_ym/end_ym or created_at
  void hasDates;
  const dated = ['professional_experiences', 'professional_education', 'projects'].includes(table);
  const order = dated
    ? `ORDER BY ${table === 'professional_experiences' ? 'current DESC,' : ''}
       COALESCE(end_ym, '9999-99') DESC, start_ym DESC, id DESC`
    : 'ORDER BY created_at DESC, id DESC';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${table} WHERE user_id = ? ${order}`, [userId]
  );
  return rows as unknown as Array<Record<string, unknown>>;
}

/** Full professional payload for a profile page. */
export async function getProfessionalProfile(userId: number): Promise<Record<string, unknown>> {
  const [experiences, education, skills, certifications, projects, recommendations, profile] = await Promise.all([
    listSection(userId, 'experiences'),
    listSection(userId, 'education'),
    listSection(userId, 'skills'),
    listSection(userId, 'certifications'),
    listSection(userId, 'projects'),
    pool.query<RowDataPacket[]>(
      `SELECT r.id, r.text, r.relationship, r.created_at, u.username AS author_username, u.display_name AS author_name
       FROM recommendations r JOIN users u ON u.id = r.author_id
       WHERE r.recipient_id = ? AND r.status = 'accepted' ORDER BY r.created_at DESC`, [userId]
    ).then(([r]) => r as unknown[]),
    pool.query<RowDataPacket[]>(
      'SELECT professional_mode, headline, industry FROM profiles WHERE user_id = ?', [userId]
    ).then(([r]) => r as unknown[]),
  ]);
  const prof = ((profile as unknown as RowDataPacket[])[0] ?? {}) as RowDataPacket;
  return {
    professionalMode: !!Number(prof.professional_mode ?? 0),
    headline: prof.headline ?? null,
    industry: prof.industry ?? null,
    experiences,
    education,
    skills,
    certifications,
    projects,
    recommendations,
  };
}

// ---- Recommendations ----

async function areConnected(a: number, b: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM connection_requests
     WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
       AND status = 'accepted' LIMIT 1`, [a, b, b, a]
  );
  return rows.length > 0;
}

export async function writeRecommendation(authorId: number, recipientUsername: string, text: string, relationship?: string): Promise<Record<string, unknown>> {
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [recipientUsername]);
  if (u.length === 0) throw notFound('User not found');
  const recipientId = Number(u[0].id);
  if (recipientId === authorId) throw badRequest('You cannot recommend yourself');
  if (!(await areConnected(authorId, recipientId))) throw forbidden('Recommendations require an accepted connection');
  if (!text.trim()) throw badRequest('Recommendation text is required');
  await pool.query(
    `INSERT INTO recommendations (author_id, recipient_id, text, relationship, status)
     VALUES (?,?,?,?,'pending') ON DUPLICATE KEY UPDATE text = VALUES(text), relationship = VALUES(relationship), status = 'pending'`,
    [authorId, recipientId, text.trim(), relationship ?? null]
  );
  return { recipient: recipientUsername, status: 'pending' };
}

export async function respondToRecommendation(recipientId: number, authorUsername: string, accept: boolean): Promise<{ status: string }> {
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [authorUsername]);
  if (u.length === 0) throw notFound('User not found');
  const status = accept ? 'accepted' : 'rejected';
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE recommendations SET status = ? WHERE author_id = ? AND recipient_id = ? AND status = 'pending'`,
    [status, Number(u[0].id), recipientId]
  );
  if (res.affectedRows === 0) throw notFound('No pending recommendation from this user');
  return { status };
}

export async function listPendingRecommendations(userId: number): Promise<Array<Record<string, unknown>>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.text, r.relationship, r.created_at, u.username AS author_username, u.display_name AS author_name
     FROM recommendations r JOIN users u ON u.id = r.author_id
     WHERE r.recipient_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`, [userId]
  );
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function setProfessionalMode(userId: number, mode: boolean, headline?: string, industry?: string): Promise<void> {
  await pool.query('INSERT IGNORE INTO profiles (user_id) VALUES (?)', [userId]);
  const [res] = await pool.query<ResultSetHeader>(
    'UPDATE profiles SET professional_mode = ?, headline = COALESCE(?, headline), industry = COALESCE(?, industry) WHERE user_id = ?',
    [mode ? 1 : 0, headline ?? null, industry ?? null, userId]
  );
  if (res.affectedRows === 0) throw notFound('Profile not found');
}

void assertOwner;
