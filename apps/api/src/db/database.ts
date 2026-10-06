import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  charset: 'utf8mb4',
});

export async function checkDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function migrate(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const fs = await import('node:fs');
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name as string));
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        await conn.query(stmt);
      }
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      await conn.commit();
      console.log(`applied migration ${file}`);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
