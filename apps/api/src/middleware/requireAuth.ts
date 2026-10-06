import type { Request, Response, NextFunction } from 'express';
import { requireSession, type AuthContext } from '../auth/authService.js';

/** Attaches ctx to req when a valid bearer token is present; 401 otherwise. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : undefined;
    const ctx: AuthContext = await requireSession(token);
    (req as any).ctx = ctx;
    next();
  } catch (e) {
    next(e);
  }
}

/** Attaches ctx to req when a valid bearer token is present; leaves req.ctx undefined otherwise. */
export async function attachOptionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : undefined;
    if (token) (req as any).ctx = await requireSession(token);
    next();
  } catch {
    next(); // invalid token treated as anonymous
  }
}
