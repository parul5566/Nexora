import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { aiService } from './aiService.js';
import { AiUnavailableError } from './aiProvider.js';

const router = Router();

const MAX_INPUT = 8000;

router.get('/ai/status', requireAuth, async (_req, res) => {
  res.json({ available: aiService.available, features: aiService.listFeatures() });
});

router.post('/ai/:feature', requireAuth, async (req: any, res) => {
  const input = typeof req.body?.input === 'string' ? req.body.input : '';
  if (!input.trim()) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'input is required' } });
  }
  if (input.length > MAX_INPUT) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `input exceeds ${MAX_INPUT} characters` } });
  }
  const known = aiService.listFeatures().includes(req.params.feature);
  if (!known) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Unknown AI feature: ${req.params.feature}` } });
  }
  try {
    const out = await aiService.run(req.params.feature, input);
    return res.json(out);
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      return res.status(503).json({ available: false, error: { code: 'AI_UNAVAILABLE', message: e.message } });
    }
    throw e;
  }
});

export default router;
