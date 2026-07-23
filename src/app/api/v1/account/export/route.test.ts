import { describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, limited: false }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/storage', () => ({ signAsset: async () => 'https://signed/x' }));
vi.mock('@/server/lib/rate-limit', async () => {
  const { ApiError } = await import('@/server/lib/errors');
  return { assertRateLimit: () => { if (h.limited) throw new ApiError(429, 'rate_limited', 'Too many requests'); } };
});
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { GET } from './route';
const get = () => GET(new Request('https://m/api/v1/account/export'));

describe('GET /api/v1/account/export (DPDP access right)', () => {
  it('returns every parent-scoped section, including the newer tables', async () => {
    h.limited = false;
    h.db = makeSupabase({ tables: { heroes: { data: [] }, books: { data: [] } } });
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // A representative access response spans all the tables we hold about them.
    for (const key of ['profile', 'consentRecords', 'heroes', 'books', 'orders', 'occasionNudges', 'photoUploads']) {
      expect(body).toHaveProperty(key);
    }
  });

  it('is rate-limited (a full export is not a loopable endpoint)', async () => {
    h.limited = true;
    h.db = makeSupabase({});
    const res = await get();
    expect(res.status).toBe(429);
  });
});
