import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../db/database.js';
import { badRequest, conflict, forbidden, notFound } from '@nexora/shared';
import { requireCompanyRole } from '../companies/companyService.js';

export interface JobView {
  id: number;
  company: { id: number; name: string; slug: string };
  title: string;
  description: string;
  location: string | null;
  type: string;
  remote: boolean;
  myApplicationStatus: string | null;
  saved: boolean;
  createdAt: string;
}

function toView(row: RowDataPacket): JobView {
  return {
    id: Number(row.id),
    company: { id: Number(row.company_id), name: row.company_name, slug: row.company_slug },
    title: row.title,
    description: row.description,
    location: row.location ?? null,
    type: row.type,
    remote: !!Number(row.remote),
    myApplicationStatus: row.app_status ?? null,
    saved: row.saved ? !!Number(row.saved) : false,
    createdAt: row.created_at,
  };
}

const SELECT = `
  SELECT j.*, c.name AS company_name, c.slug AS company_slug,
    (SELECT status FROM job_applications ja WHERE ja.job_id = j.id AND ja.user_id = ?) AS app_status,
    (SELECT 1 FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.user_id = ?) AS saved
  FROM jobs j JOIN companies c ON c.id = j.company_id`;

export async function createJob(userId: number, companySlug: string, data: {
  title: string; description: string; location?: string; type?: string; remote?: boolean;
}): Promise<JobView> {
  const type = data.type ?? 'full-time';
  if (!['full-time', 'part-time', 'contract', 'internship'].includes(type)) throw badRequest('Invalid job type');
  if (!data.title?.trim() || !data.description?.trim()) throw badRequest('Title and description are required');
  const { company } = await requireCompanyRole(userId, companySlug, ['admin', 'recruiter']);
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO jobs (company_id, posted_by, title, description, location, type, remote)
     VALUES (?,?,?,?,?,?,?)`,
    [company.id, userId, data.title.trim(), data.description.trim(), data.location ?? null, type, data.remote ? 1 : 0]
  );
  return await getJob(Number(res.insertId), userId);
}

export async function getJob(jobId: number, viewerId: number): Promise<JobView> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE j.id = ?`, [viewerId, viewerId, jobId]);
  if (rows.length === 0) throw notFound('Job not found');
  return toView(rows[0]);
}

export async function searchJobs(viewerId: number, filters: {
  q?: string; location?: string; type?: string; remote?: boolean; limit?: number; cursor?: string;
}): Promise<{ jobs: JobView[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? 20, 50);
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.q) { where.push('j.title LIKE ?'); params.push(`%${filters.q}%`); }
  if (filters.location) { where.push('j.location LIKE ?'); params.push(`%${filters.location}%`); }
  if (filters.type) {
    if (!['full-time', 'part-time', 'contract', 'internship'].includes(filters.type)) throw badRequest('Invalid job type');
    where.push('j.type = ?'); params.push(filters.type);
  }
  if (filters.remote) where.push('j.remote = 1');
  if (filters.cursor) { where.push('j.id < ?'); params.push(filters.cursor); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rowsParams = [viewerId, viewerId, ...params, limit + 1];
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT} ${clause} ORDER BY j.id DESC LIMIT ?`, rowsParams
  );
  const hasMore = rows.length > limit;
  const jobs = rows.slice(0, limit).map(toView);
  return { jobs, nextCursor: hasMore ? String(jobs[jobs.length - 1].id) : null };
}

export async function applyToJob(userId: number, jobId: number, data: { coverLetter?: string; resumeUrl?: string }): Promise<{ applied: boolean }> {
  const [job] = await pool.query<RowDataPacket[]>('SELECT id FROM jobs WHERE id = ?', [jobId]);
  if (job.length === 0) throw notFound('Job not found');
  try {
    await pool.query(
      'INSERT INTO job_applications (job_id, user_id, cover_letter, resume_url) VALUES (?,?,?,?)',
      [jobId, userId, data.coverLetter ?? null, data.resumeUrl ?? null]
    );
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') throw conflict('You already applied to this job');
    throw e;
  }
  return { applied: true };
}

export async function saveJob(userId: number, jobId: number, save: boolean): Promise<{ saved: boolean }> {
  const [job] = await pool.query<RowDataPacket[]>('SELECT id FROM jobs WHERE id = ?', [jobId]);
  if (job.length === 0) throw notFound('Job not found');
  if (save) await pool.query('INSERT IGNORE INTO saved_jobs (job_id, user_id) VALUES (?,?)', [jobId, userId]);
  else await pool.query('DELETE FROM saved_jobs WHERE job_id = ? AND user_id = ?', [jobId, userId]);
  return { saved: save };
}

export async function listSavedJobs(userId: number): Promise<JobView[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT} JOIN saved_jobs sj2 ON sj2.job_id = j.id AND sj2.user_id = ?
     ORDER BY sj2.created_at DESC`, [userId, userId, userId]
  );
  return rows.map(toView);
}

export async function listApplicants(userId: number, jobId: number): Promise<Array<Record<string, unknown>>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT j.company_id, j.posted_by FROM jobs j WHERE j.id = ?', [jobId]
  );
  if (rows.length === 0) throw notFound('Job not found');
  const role = await (async () => {
    const { companyRoleFor } = await import('../companies/companyService.js');
    return companyRoleFor(userId, Number(rows[0].company_id));
  })();
  if (!role) throw forbidden('Only company admins/recruiters can view applicants');
  const [apps] = await pool.query<RowDataPacket[]>(
    `SELECT ja.id, ja.status, ja.cover_letter, ja.resume_url, ja.created_at,
            u.username, u.display_name
     FROM job_applications ja JOIN users u ON u.id = ja.user_id
     WHERE ja.job_id = ? ORDER BY ja.created_at DESC`, [jobId]
  );
  return apps.map((a) => ({
    id: Number(a.id),
    username: a.username,
    displayName: a.display_name,
    profileUrl: `/u/${a.username}`,
    status: a.status,
    coverLetter: a.cover_letter,
    resumeUrl: a.resume_url,
    appliedAt: a.created_at,
  }));
}

export async function updateApplicationStatus(userId: number, applicationId: number, status: string): Promise<{ updated: boolean }> {
  if (!['applied', 'viewed', 'rejected', 'hired'].includes(status)) throw badRequest('Invalid status');
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT ja.job_id, ja.user_id, j.company_id FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.id = ?',
    [applicationId]
  );
  if (rows.length === 0) throw notFound('Application not found');
  const role = await (async () => {
    const { companyRoleFor } = await import('../companies/companyService.js');
    return companyRoleFor(userId, Number(rows[0].company_id));
  })();
  if (!role) throw forbidden('Only company admins/recruiters can update applications');
  const [res] = await pool.query<ResultSetHeader>(
    'UPDATE job_applications SET status = ? WHERE id = ?', [status, applicationId]
  );
  if (res.affectedRows === 0) throw notFound('Application not found');
  // notify the applicant
  try {
    const { notify } = await import('../notifications/notificationService.js');
    await notify(BigInt(userId), BigInt(rows[0].user_id), 'mention', { jobId: String(rows[0].job_id), applicationStatus: status },
      `jobapp:${applicationId}:${status}`);
  } catch { /* notification is best-effort */ }
  return { updated: true };
}

export async function listMyApplications(userId: number): Promise<Array<Record<string, unknown>>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ja.id, ja.status, ja.created_at, j.title, j.id AS job_id, c.name AS company_name
     FROM job_applications ja JOIN jobs j ON j.id = ja.job_id JOIN companies c ON c.id = j.company_id
     WHERE ja.user_id = ? ORDER BY ja.created_at DESC`, [userId]
  );
  return rows.map((r) => ({
    id: Number(r.id), jobTitle: r.title, jobId: Number(r.job_id), company: r.company_name,
    status: r.status, appliedAt: r.created_at,
  }));
}
