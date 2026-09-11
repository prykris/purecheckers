import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { JOIN_CODE_PATTERN } from '../domain/rooms.js';
import { parsePuzzleDate } from '../../shared/puzzleDates.js';
import { cardService } from '../og/service.js';
const fallback = res => res.set('Cache-Control', 'no-store').redirect(302, '/og-image.png');
export function createOgRouter({ service = cardService, clock } = {}) {
  const router = Router(), misses = createRateLimiter({ limit: 10, clock });
  router.use(createRateLimiter({ limit: 60, clock }));
  router.get('/:kind/:value.png', (req, res) => {
    const { kind } = req.params;
    const value = kind === 'invite' ? req.params.value.toUpperCase() : req.params.value;
    const valid = kind === 'game' ? /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647
      : kind === 'player' ? value.length >= 2 && value.length <= 64 && !/[\x00-\x1f\x7f]/.test(value)
      : kind === 'puzzle' ? !!parsePuzzleDate(value) : kind === 'invite' && JOIN_CODE_PATTERN.test(value);
    if (!valid) return fallback(res);
    const serve = async () => {
      try {
        const card = await service.get(kind, value);
        if (!card) return fallback(res);
        res.set('ETag', card.etag).set('Cache-Control', card.maxAge ? `public, max-age=${card.maxAge}${card.maxAge > 60 ? ', immutable' : ''}` : 'public, max-age=0, must-revalidate');
        res.type('png');
        if (req.fresh) return res.status(304).end();
        res.send(card.png);
      } catch (err) { console.warn('[og] preview unavailable:', err.message); fallback(res); }
    };
    if (service.hasRequest(kind + '/' + value)) void serve();
    else misses(req, res, () => { void serve(); });
  });
  return router;
}
export default createOgRouter();
