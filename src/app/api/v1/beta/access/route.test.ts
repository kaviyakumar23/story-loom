import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ valid: true, status: { enabled: true, granted: false } }));
vi.mock('@/server/lib/beta-access', () => ({
  betaAccessStatus: () => h.status,
  isValidBetaCode: () => h.valid,
  betaAccessCookie: () => 'moonbell_beta_access=x; Path=/; HttpOnly',
}));
vi.mock('@/server/lib/rate-limit', () => ({ assertRateLimit: () => {}, clientIp: () => '1.2.3.4' }));

import { GET, POST } from './route';

const post = (code: unknown) => POST(new Request('https://m/api/v1/beta/access', { method: 'POST', body: JSON.stringify({ code }) }));

describe('beta/access route (integration)', () => {
  it('GET reports the current access status', async () => {
    const res = await GET(new Request('https://m/api/v1/beta/access'));
    expect(await res.json()).toEqual({ enabled: true, granted: false });
  });

  it('POST grants and sets the cookie for a valid code', async () => {
    h.valid = true;
    const res = await post('moonbell-beta');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ granted: true });
    expect(res.headers.get('set-cookie')).toContain('moonbell_beta_access');
  });

  it('POST rejects an invalid code (403, no cookie)', async () => {
    h.valid = false;
    const res = await post('wrong');
    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('POST rejects an empty code payload', async () => {
    const res = await post('');
    expect(res.status).toBe(400);
  });
});
