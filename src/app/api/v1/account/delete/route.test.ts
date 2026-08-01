import { describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, erased: [] as string[], block: null as { reason: string; retryAfter: Date } | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'parent-1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/erasure', () => ({
  eraseParentData: async (id: string) => { h.erased.push(id); },
  findErasureBlock: async () => h.block,
}));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

describe('POST /api/v1/account/delete (integration)', () => {
  it('records a pending deletion request, then runs erasure', async () => {
    h.erased = []; h.block = null;
    h.db = makeSupabase({ tables: { deletion_requests: { data: { id: 'dr-1' } } } });
    const res = await POST(new Request('https://m/api/v1/account/delete', { method: 'POST' }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: 'completed' });
    expect(findOp(h.db, 'deletion_requests', 'insert')?.values).toMatchObject({ parent_id: 'parent-1', status: 'pending' });
    expect(h.erased).toEqual(['parent-1']); // erasure actually ran
  });

  // Deleting through a printed order used to cascade away the fulfilment row and
  // the shipping address and delete the print master — silently cancelling a
  // book someone had paid for, with nothing left to show it existed.
  it('defers erasure while a printed order is still in flight', async () => {
    h.erased = [];
    h.block = { reason: 'A printed order is still in progress (printing).', retryAfter: new Date('2026-08-21T00:00:00Z') };
    h.db = makeSupabase({ tables: { deletion_requests: { data: { id: 'dr-1' } } } });
    const res = await POST(new Request('https://m/api/v1/account/delete', { method: 'POST' }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ status: 'deferred' });
    expect(h.erased).toEqual([]); // nothing deleted while the book is in flight
    expect(findOp(h.db, 'deletion_requests', 'update')?.values).toMatchObject({ status: 'deferred' });
  });
});
