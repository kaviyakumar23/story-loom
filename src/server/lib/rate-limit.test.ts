import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { __resetRateLimits, assertRateLimit, clientIp, rateLimit } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useRealTimers();
  });

  it('allows up to the limit and then refuses', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit('k', 5, 60_000).ok, `call ${i + 1}`).toBe(true);
    }
    expect(rateLimit('k', 5, 60_000).ok).toBe(false);
  });

  it('keeps separate callers separate', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('a', 5, 60_000);
    expect(rateLimit('a', 5, 60_000).ok).toBe(false);
    expect(rateLimit('b', 5, 60_000).ok).toBe(true);
  });

  it('lets the caller back in once the window rolls over', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i += 1) rateLimit('k', 5, 1000);
    expect(rateLimit('k', 5, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit('k', 5, 1000).ok).toBe(true);
  });

  it('reports a usable retry-after', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i += 1) rateLimit('k', 3, 10_000);
    const denied = rateLimit('k', 3, 10_000);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(10);
  });

  it('assertRateLimit throws a 429 once over', () => {
    for (let i = 0; i < 2; i += 1) assertRateLimit('k', 2, 60_000);
    try {
      assertRateLimit('k', 2, 60_000);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(429);
    }
  });
});

describe('clientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    const req = new Request('https://x.test', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('falls back rather than throwing when the header is absent', () => {
    expect(clientIp(new Request('https://x.test'))).toBe('unknown');
  });
});
