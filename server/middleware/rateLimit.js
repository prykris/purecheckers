import { getClientAddress } from './clientAddress.js';
import { performance } from 'node:perf_hooks';

// Small in-memory token bucket per client IP. Enough for one process on one host; the
// public, unauthenticated routes (invite pre-check, bot roster) use it so a script cannot
// probe codes or hammer the database.
export function createRateLimiter({ limit = 60, windowMs = 60_000, maxClients = 10_000, keyOf = getClientAddress, clock = () => performance.now() } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0
    || !Number.isInteger(maxClients) || maxClients < 1) throw new Error('Invalid rate limiter capacity');
  const buckets = new Map(); // key -> { tokens, updatedAt }
  const refillPerMs = limit / windowMs;
  let sweptAt = clock();
  const overflow = { tokens: limit, updatedAt: sweptAt };

  function take(key, now) {
    let bucket = buckets.get(key);
    if (!bucket) {
      // Rotating addresses cannot allocate unlimited buckets or evict an active
      // client's limit. New identities share one bucket until idle entries expire.
      bucket = buckets.size < maxClients ? { tokens: limit, updatedAt: now } : overflow;
      if (bucket !== overflow) buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(limit, bucket.tokens + Math.max(0, now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  function sweep(now) {
    if (now - sweptAt < windowMs) return;
    sweptAt = now;
    for (const [key, bucket] of buckets) if (now - bucket.updatedAt > windowMs) buckets.delete(key);
  }

  const middleware = (req, res, next) => {
    const now = clock();
    sweep(now);
    if (take(keyOf(req) || 'unknown', now)) return next();
    res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
    res.status(429).json({ error: 'Too many requests' });
  };
  middleware.reset = () => {
    buckets.clear();
    sweptAt = clock();
    overflow.tokens = limit;
    overflow.updatedAt = sweptAt;
  };
  return middleware;
}
