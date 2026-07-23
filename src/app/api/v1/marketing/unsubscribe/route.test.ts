import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));

import { GET } from './route';
import { unsubscribeSignature } from '@/server/lib/marketing';

describe('GET /api/v1/marketing/unsubscribe (integration)', () => {
  const parent = '11111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.SUPABASE_ANON_KEY = 'k';
    process.env.MARKETING_UNSUBSCRIBE_SECRET = 'test-secret';
    process.env.APP_BASE_URL = 'https://moonbell.in';
  });
  beforeEach(() => {
    h.db = makeSupabase({ tables: { profiles: { data: null } } });
  });

  it('turns marketing consent OFF on a valid token', async () => {
    const token = unsubscribeSignature(parent);
    const res = await GET(new Request(`https://m/api/v1/marketing/unsubscribe?u=${parent}&t=${token}`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('unsubscribed');
    const upd = findOp(h.db!, 'profiles', 'update');
    expect(upd?.values).toEqual({ marketing_consent: false });
  });

  it('rejects a forged token and never writes', async () => {
    const res = await GET(new Request(`https://m/api/v1/marketing/unsubscribe?u=${parent}&t=deadbeef`));
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'profiles', 'update')).toBeUndefined();
  });

  it('rejects a missing token', async () => {
    const res = await GET(new Request(`https://m/api/v1/marketing/unsubscribe?u=${parent}`));
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'profiles', 'update')).toBeUndefined();
  });
});
