// Module 26: seed a multi-thousand-row dataset for performance testing.
// Idempotent-ish: uses a marker username prefix; safe to re-run.
import { pool } from '../db/database.js';

const PREFIX = 'perf';
const N_USERS = 5000;
const N_POSTS = 20000;
const N_REACTIONS = 50000;
const N_MESSAGES = 10000;
const N_NOTIFS = 10000;

async function alreadySeeded(): Promise<boolean> {
    const [rows]: any = await pool.query('SELECT COUNT(*) AS c FROM users WHERE username LIKE ?', [`${PREFIX}%`]);
    return Number(rows[0].c) >= N_USERS;
}

export async function seedPerformanceData(): Promise<{ seeded: boolean; users: number; posts: number }> {
    if (await alreadySeeded()) {
        const [u]: any = await pool.query('SELECT COUNT(*) AS c FROM users WHERE username LIKE ?', [`${PREFIX}%`]);
        const [p]: any = await pool.query(
            'SELECT COUNT(*) AS c FROM posts JOIN users ON users.id = posts.author_id WHERE users.username LIKE ? AND posts.deleted_at IS NULL',
            [`${PREFIX}%`]
        );
        return { seeded: false, users: Number(u[0].c), posts: Number(p[0].c) };
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const users: Array<[string, string, string]> = [];
        for (let i = 0; i < N_USERS; i++) {
            users.push([`${PREFIX}_user${i}`, `Perf User ${i}`, `${PREFIX}.user${i}@perf.test`]);
        }
        // batch insert users (password irrelevant for perf testing; bcrypt of a fixed hash)
        const fixedHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8DsAMd4xM8oL9Zz9ZbJ3y6a7Qh1Bhu'; // 'Passw0rd!23'
        const vals: unknown[] = [];
        const ph = users.map(() => '(?, ?, ?, ?, NOW())').join(',');
        for (const u of users) { vals.push(u[0], u[1], u[2], fixedHash); }
        await conn.query(
            `INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES ${ph}`,
            vals
        );

        const [urows]: any = await conn.query('SELECT id FROM users WHERE username LIKE ?', [`${PREFIX}%`]);
        const ids = (urows as any[]).map((r) => r.id);

        // follows: each user follows ~10 subsequent users
        const followVals: unknown[] = [];
        for (let i = 0; i < ids.length; i++) {
            for (let j = 1; j <= 10; j++) {
                followVals.push(ids[i], ids[(i + j * 97) % ids.length]);
            }
        }
        const followPh = [];
        for (let i = 0; i < followVals.length / 2; i++) followPh.push('(?, ?)');
        for (let i = 0; i < followVals.length; i += 4000) {
            const slice = followVals.slice(i, i + 4000);
            const slicePh = [];
            for (let k = 0; k < slice.length / 2; k++) slicePh.push('(?, ?)');
            await conn.query(`INSERT IGNORE INTO follows (follower_id, followee_id) VALUES ${slicePh.join(',')}`, slice);
        }

        // posts
        const postVals: unknown[] = [];
        for (let i = 0; i < N_POSTS; i++) {
            postVals.push(ids[i % ids.length], `Performance seed post number ${i} #perf ${i % 7 === 0 ? '#trending' : ''}`);
        }
        for (let i = 0; i < postVals.length; i += 4000) {
            const slice = postVals.slice(i, i + 4000);
            const slicePh = [];
            for (let k = 0; k < slice.length / 2; k++) slicePh.push('(?, NOW(), ?, \'public\', 0)');
            await conn.query(
                `INSERT INTO posts (author_id, created_at, content, visibility, is_draft) VALUES ${slicePh.join(',')}`,
                slice
            );
        }

        const [prows]: any = await conn.query(
            'SELECT id FROM posts ORDER BY id DESC LIMIT ?', [N_POSTS]
        );
        const postIds = (prows as any[]).map((r) => r.id);

        // reactions
        const REACTION_TYPES = ['like', 'love', 'haha', 'wow'];
        const reactVals: unknown[] = [];
        for (let i = 0; i < N_REACTIONS; i++) {
            reactVals.push(ids[i % ids.length], postIds[i % postIds.length], REACTION_TYPES[i % 4]);
        }
        for (let i = 0; i < reactVals.length; i += 3999 * 3) {
            const slice = reactVals.slice(i, i + 3999 * 3);
            const n = Math.floor(slice.length / 3);
            const slicePh = Array.from({ length: n }, () => '(?, ?, ?)');
            await conn.query(`INSERT IGNORE INTO reactions (user_id, post_id, type) VALUES ${slicePh.join(',')}`, slice.slice(0, n * 3));
        }

        // messages: pick two users, one conversation
        const [conv]: any = await conn.query(
            'INSERT INTO conversations (created_by) VALUES (?)', [ids[0]]
        );
        const convId = conv.insertId;
        await conn.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)', [convId, ids[0], convId, ids[1]]);
        const msgVals: unknown[] = [];
        for (let i = 0; i < N_MESSAGES; i++) {
            msgVals.push(convId, i % 2 === 0 ? ids[0] : ids[1], `perf message ${i}`);
        }
        for (let i = 0; i < msgVals.length; i += 3000) {
            const slice = msgVals.slice(i, i + 3000);
            const slicePh = [];
            for (let k = 0; k < slice.length / 3; k++) slicePh.push('(?, ?, ?)');
            await conn.query(`INSERT INTO messages (conversation_id, sender_id, content) VALUES ${slicePh.join(',')}`, slice);
        }

        // notifications for one recipient
        const notifVals: unknown[] = [];
        for (let i = 0; i < N_NOTIFS; i++) {
            notifVals.push(ids[0], 'follow', ids[i % ids.length], JSON.stringify({ seed: i }));
        }
        for (let i = 0; i < notifVals.length; i += 3000) {
            const slice = notifVals.slice(i, i + 3000);
            const slicePh = [];
            for (let k = 0; k < slice.length / 4; k++) slicePh.push('(?, ?, ?, ?)');
            await conn.query(
                `INSERT INTO notifications (user_id, type, actor_id, payload) VALUES ${slicePh.join(',')}`,
                slice
            );
        }

        await conn.commit();
        return { seeded: true, users: ids.length, posts: postIds.length };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

if (process.argv[1] && process.argv[1].includes('seedPerformance')) {
    seedPerformanceData()
        .then((r) => { console.log(r); process.exit(0); })
        .catch((e) => { console.error(e); process.exit(1); });
}
