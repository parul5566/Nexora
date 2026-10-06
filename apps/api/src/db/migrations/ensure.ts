// Ensures base schema exists on boot (idempotent complement to migrate.ts)
import { migrate } from '../../db/database.js';

let done: Promise<void> | null = null;
export default function ensureSchema() {
  done ??= migrate();
  return done;
}
