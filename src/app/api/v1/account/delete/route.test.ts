import { describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, erased: [] as string[] }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'parent-1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/erasure', () => ({ eraseParentData: async (id: string) => { h.erased.push(id); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

describe('POST /api/v1/account/delete (integration)', () => {
  it('records a pending deletion request, then runs erasure', async () => {
    h.erased = [];
    h.db = makeSupabase({ tables: { deletion_requests: { data: { id: 'dr-1' } } } });
    const res = await POST(new Request('https://m/api/v1/account/delete', { method: 'POST' }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: 'completed' });
    expect(findOp(h.db, 'deletion_requests', 'insert')?.values).toMatchObject({ parent_id: 'parent-1', status: 'pending' });
    expect(h.erased).toEqual(['parent-1']); // erasure actually ran
  });
});
