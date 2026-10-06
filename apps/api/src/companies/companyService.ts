import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/database.js';
import { badRequest, forbidden, notFound } from '@nexora/shared';

export type CompanyRole = 'admin' | 'recruiter';

export interface CompanyView {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  industry: string | null;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
  followerCount: number;
  myRole: string | null;
  createdAt: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

function toView(row: RowDataPacket): CompanyView {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    tagline: row.tagline ?? null,
    industry: row.industry ?? null,
    website: row.website ?? null,
    logoUrl: row.logo_url ?? null,
    description: row.description ?? null,
    followerCount: Number(row.follower_count ?? 0),
    myRole: row.my_role ?? null,
    createdAt: row.created_at,
  };
}

async function refreshFollowerCount(companyId: number): Promise<void> {
  await pool.query(
    'UPDATE companies SET follower_count = (SELECT COUNT(*) FROM company_followers WHERE company_id = ?) WHERE id = ?',
    [companyId, companyId]
  );
}

export async function createCompany(userId: number, data: {
  name: string; tagline?: string; industry?: string; website?: string; description?: string; logoUrl?: string;
}): Promise<CompanyView> {
  let slug = slugify(data.name);
  if (!slug) throw badRequest('Company name must contain letters or numbers');
  const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM companies WHERE slug = ?', [slug]);
  if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO companies (name, slug, tagline, industry, website, logo_url, description, creator_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [data.name, slug, data.tagline ?? null, data.industry ?? null, data.website ?? null,
        data.logoUrl ?? null, data.description ?? null, userId]
    );
    await conn.query('INSERT INTO company_admins (company_id, user_id, role) VALUES (?,?,?)', [res.insertId, userId, 'admin']);
    await conn.commit();
    return await getCompany(slug, userId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getCompany(slug: string, viewerId: number): Promise<CompanyView> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, a.role AS my_role FROM companies c
     LEFT JOIN company_admins a ON a.company_id = c.id AND a.user_id = ?
     WHERE c.slug = ?`, [viewerId, slug]
  );
  if (rows.length === 0) throw notFound('Company not found');
  return toView(rows[0]);
}

async function companyRole(userId: number, companyId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT role FROM company_admins WHERE company_id = ? AND user_id = ?', [companyId, userId]
  );
  return rows.length > 0 ? rows[0].role : null;
}

export async function getCompanyById(id: number, viewerId: number): Promise<CompanyView> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, a.role AS my_role FROM companies c
     LEFT JOIN company_admins a ON a.company_id = c.id AND a.user_id = ?
     WHERE c.id = ?`, [viewerId, id]
  );
  if (rows.length === 0) throw notFound('Company not found');
  return toView(rows[0]);
}

export async function requireCompanyRole(userId: number, slugOrId: string | number, allowed: CompanyRole[]): Promise<{ company: CompanyView; role: string }> {
  const company = typeof slugOrId === 'number'
    ? await getCompanyById(slugOrId, userId)
    : await getCompany(slugOrId, userId);
  const role = await companyRole(userId, company.id);
  if (!role || !allowed.includes(role as CompanyRole)) throw forbidden('Insufficient company role');
  return { company, role };
}

export async function updateCompany(userId: number, slug: string, data: Record<string, unknown>): Promise<CompanyView> {
  await requireCompanyRole(userId, slug, ['admin']); // branding: admins only
  const allowed = ['tagline', 'industry', 'website', 'logo_url', 'description'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    const col = key === 'logoUrl' ? 'logo_url' : key;
    if (!allowed.includes(col)) continue;
    sets.push(`${col} = ?`);
    vals.push(value);
  }
  if (sets.length === 0) throw badRequest('No updatable fields provided');
  const company = await getCompany(slug, userId);
  vals.push(company.id);
  await pool.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getCompany(slug, userId);
}

export async function addCompanyAdmin(actorId: number, slug: string, username: string, role: CompanyRole): Promise<{ added: boolean }> {
  await requireCompanyRole(actorId, slug, ['admin']);
  const [u] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [username]);
  if (u.length === 0) throw notFound('User not found');
  const company = await getCompany(slug, actorId);
  await pool.query('INSERT IGNORE INTO company_admins (company_id, user_id, role) VALUES (?,?,?)', [company.id, Number(u[0].id), role]);
  return { added: true };
}

export async function followCompany(userId: number, slug: string): Promise<CompanyView> {
  const company = await getCompany(slug, userId);
  await pool.query('INSERT IGNORE INTO company_followers (company_id, user_id) VALUES (?,?)', [company.id, userId]);
  await refreshFollowerCount(company.id);
  return getCompany(slug, userId);
}

export async function unfollowCompany(userId: number, slug: string): Promise<CompanyView> {
  const company = await getCompany(slug, userId);
  await pool.query('DELETE FROM company_followers WHERE company_id = ? AND user_id = ?', [company.id, userId]);
  await refreshFollowerCount(company.id);
  return getCompany(slug, userId);
}

export async function listCompanies(viewerId: number, search?: string, limit = 20, cursor?: string): Promise<{ companies: CompanyView[]; nextCursor: string | null }> {
  limit = Math.min(limit, 50);
  const params: unknown[] = [];
  let where = '1=1';
  if (search) {
    where += ' AND (c.name LIKE ? OR c.industry LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (cursor) { where += ' AND c.id < ?'; params.push(cursor); }
  params.push(limit + 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, a.role AS my_role FROM companies c
     LEFT JOIN company_admins a ON a.company_id = c.id AND a.user_id = ?
     WHERE ${where} ORDER BY c.id DESC LIMIT ?`, [viewerId, ...params]
  );
  const hasMore = rows.length > limit;
  const companies = rows.slice(0, limit).map(toView);
  return { companies, nextCursor: hasMore ? String(companies[companies.length - 1].id) : null };
}

export async function listCompanyPosts(company: CompanyView, viewerId: number, limit = 20, cursor?: string): Promise<{ posts: RowDataPacket[]; nextCursor: string | null }> {
  limit = Math.min(limit, 50);
  const params: unknown[] = [company.id];
  if (cursor) { params.push(cursor); }
  params.push(limit + 1);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, u.username, u.display_name FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.company_id = ? AND p.is_draft = 0 AND p.deleted_at IS NULL
       ${cursor ? 'AND p.id < ?' : ''}
     ORDER BY p.id DESC LIMIT ?`, params
  );
  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);
  return { posts, nextCursor: hasMore ? String(posts[posts.length - 1].id) : null };
}

export async function companyRoleFor(userId: number, companyId: number): Promise<string | null> {
  return companyRole(userId, companyId);
}

/** Analytics */
export async function companyAnalytics(userId: number, slug: string): Promise<Record<string, unknown>> {
  const company = await getCompany(slug, userId);
  const [followers] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
     FROM company_followers WHERE company_id = ? GROUP BY day ORDER BY day DESC LIMIT 30`, [company.id]
  );
  const [engagement] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT p.id) AS posts,
            COALESCE((SELECT COUNT(*) FROM reactions r JOIN posts p2 ON p2.id = r.post_id WHERE p2.company_id = ?), 0) AS reactions,
            COALESCE((SELECT COUNT(*) FROM comments c JOIN posts p3 ON p3.id = c.post_id WHERE p3.company_id = ? AND c.deleted_at IS NULL), 0) AS comments
     FROM posts p WHERE p.company_id = ? AND p.deleted_at IS NULL`,
    [company.id, company.id, company.id]
  );
  return {
    followers: company.followerCount,
    followerGrowth: followers.map((r) => ({ day: r.day, count: Number(r.count) })),
    posts: Number(engagement[0].posts ?? 0),
    reactions: Number(engagement[0].reactions ?? 0),
    comments: Number(engagement[0].comments ?? 0),
  };
}
