import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@nexora/shared';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  logger.error('unhandled error', err instanceof Error ? { stack: err.stack } : err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
