import express from 'express';
import { checkDb, pool } from './db/database.js';
import { checkRedis } from './cache/kv.js';
import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { authLimiter, writeLimiter } from './middleware/rateLimit.js';
import authRoutes from './auth/authRoutes.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(securityHeaders);

// request logging
app.use((req, _res, next) => {
  logger.info('request', { method: req.method, path: req.path });
  next();
});

app.get('/api/v1/health', async (_req, res) => {
  const db = await checkDb();
  const redis = await checkRedis();
  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    services: { database: db ? 'connected' : 'down', cache: redis ? 'connected' : 'memory-fallback' },
  });
});

app.use('/api/v1', authLimiter(), authRoutes);
app.use('/api/v1', (await import('./seo/seoRoutes.js')).default);
app.use('/api/v1', (await import('./social/socialRoutes.js')).default);
app.use('/api/v1', writeLimiter(), (await import('./posts/postRoutes.js')).default);
app.use('/api/v1', (await import('./media/mediaRoutes.js')).default);
app.use('/api/v1', (await import('./posts/engagementRoutes.js')).default);
app.use('/api/v1', (await import('./feed/feedRoutes.js')).default);
app.use('/api/v1', (await import('./search/searchRoutes.js')).default);
app.use('/api/v1', (await import('./notifications/notificationRoutes.js')).default);
app.use('/api/v1', (await import('./messaging/messageRoutes.js')).default);
app.use('/api/v1', (await import('./stories/storyRoutes.js')).default);
app.use('/api/v1', (await import('./reels/reelRoutes.js')).default);
app.use('/api/v1', (await import('./communities/communityRoutes.js')).default);
app.use('/api/v1', (await import('./professional/professionalRoutes.js')).default);
app.use('/api/v1', (await import('./companies/companyRoutes.js')).default);
app.use('/api/v1', (await import('./jobs/jobRoutes.js')).default);
app.use('/api/v1', (await import('./events/eventRoutes.js')).default);
app.use('/api/v1', (await import('./analytics/creatorRoutes.js')).default);
app.use('/api/v1', (await import('./moderation/moderationRoutes.js')).default);
app.use('/api/v1', (await import('./admin/adminRoutes.js')).default);
app.use('/api/v1', (await import('./ai/aiRoutes.js')).default);
app.use('/media', express.static(process.env.MEDIA_DIR || '/workspace/apps/api/media', {
  maxAge: '7d',
}));

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);

// WebSocket hub (Module 11) attaches to the HTTP server when start() runs.
export async function start() {
  const db = await checkDb();
  if (!db) throw new Error('Database not reachable at startup');
  await import('./db/migrations/ensure.js');
  const http = await import('node:http');
  const server = http.createServer(app);
  const { setupWebSocket } = await import('./messaging/wsHub.js');
  setupWebSocket(server);
  server.listen(PORT, () => logger.info(`API listening on ${PORT}`));
}

if (process.env.RUN_MAIN !== 'false') {
  start().catch((e) => {
    logger.error('startup failed', e);
    process.exit(1);
  });
}

export default app;
