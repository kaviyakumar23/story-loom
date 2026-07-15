import { ApiError } from './errors';

/**
 * Best-effort in-process rate limiting.
 *
 * Be clear about what this is: serverless gives each warm instance its own
 * bucket, so the true ceiling is (instances × limit). It is a speed bump against
 * brute force and accidental hammering — NOT a quota. The hard quota for the
 * expensive path is the per-account daily cap in POST /books, which is enforced
 * against the database and therefore actually holds. Swap in Upstash/Redis here
 * when a real global limit is needed; the call sites won't change.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
/** Cheap ceiling so a long-lived instance can't grow this map without bound. */
const MAX_TRACKED = 10_000;

function prune(now: number): void {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED) prune(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Throw a 429 when the caller is over the limit. */
export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    throw new ApiError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.', {
      retryAfterSec: result.retryAfterSec,
    });
  }
}

/** Caller identity for unauthenticated routes. Vercel sets x-forwarded-for. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Reset between tests. */
export function __resetRateLimits(): void {
  buckets.clear();
}
