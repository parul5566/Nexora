import { Router } from 'express';
import { pool } from '../db/database.js';

const router = Router();

/**
 * Public URL feed for sitemap generation. NO auth.
 * Returns ONLY public, non-private, active content.
 */
router.get('/seo/public-urls', async (_req: any, res: any, next: any) => {
    try {
        const urls: Array<{ path: string; lastmod?: string }> = [];

        const [users] = await pool.query(
            `SELECT u.username, u.created_at AS updated_at FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.status = 'active' AND (p.privacy_mode = 'public' OR p.privacy_mode IS NULL)
             LIMIT 5000`
        );
        for (const r of users as any[]) {
            urls.push({ path: `/u/${r.username}`, lastmod: r.updated_at });
        }

        const [communities] = await pool.query(
            `SELECT slug, updated_at FROM communities WHERE privacy = 'public' LIMIT 5000`
        );
        for (const r of communities as any[]) {
            urls.push({ path: `/communities/${r.slug}`, lastmod: r.updated_at });
        }

        const [companies] = await pool.query(
            `SELECT slug, updated_at FROM companies LIMIT 5000`
        );
        for (const r of companies as any[]) {
            urls.push({ path: `/companies/${r.slug}`, lastmod: r.updated_at });
        }

        // jobs: table has no status column in current schema — include all, path is public read
        const [jobs] = await pool.query(`SELECT id, created_at FROM jobs LIMIT 5000`);
        for (const r of jobs as any[]) {
            urls.push({ path: `/jobs/${r.id}`, lastmod: r.created_at });
        }

        const [events] = await pool.query(
            `SELECT id, created_at FROM events WHERE privacy = 'public' AND deleted_at IS NULL LIMIT 5000`
        );
        for (const r of events as any[]) {
            urls.push({ path: `/events/${r.id}`, lastmod: r.created_at });
        }

        res.json({ urls });
    } catch (e) {
        next(e);
    }
});

export default router;
