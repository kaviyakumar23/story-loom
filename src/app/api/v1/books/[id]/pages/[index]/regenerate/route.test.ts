import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  casResult: [{ id: 'b1' }] as { id: string }[], // what the compare-and-swap debit returns
  sends: [] as { name: string; data: { mode?: string } }[],
}));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { editApplied: 'book/edit.applied' },
  inngest: { send: async (e: { name: string; data: { mode?: string } }) => { h.sends.push(e); } },
}));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID, index: '0' }) };
const req = () => new Request(`https://m/api/v1/books/${ID}/pages/0/regenerate`, { method: 'POST', body: '{}' });

function db(credits: number) {
  return makeSupabase({
    tables: {
      books: (op) => (op === 'select'
        ? { data: { id: 'b1', parent_id: 'p1', status: 'complete', purchased_tier: 'print', render_credits: credits, deleted_at: null } }
        : { data: h.casResult }),
      fulfillments: { data: { status: 'print_ready' } },
      book_pages: { data: { page_index: 0 } },
    },
  });
}

describe('POST /books/:id/pages/:index/regenerate — image regen (integration)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.SUPABASE_ANON_KEY = 'k';
  });
  beforeEach(() => { h.casResult = [{ id: 'b1' }]; h.sends = []; });

  it('debits a credit and emits an image regen when credits remain', async () => {
    h.db = db(3);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ renderCreditsRemaining: 2 });
    const debit = findOp(h.db, 'books', 'update');
    expect(debit?.values).toMatchObject({ render_credits: 2 });
    // The CAS guards the exact prior value so two requests can't spend one credit.
    expect(debit?.filters.some((f) => f.m === 'eq' && f.args[0] === 'render_credits' && f.args[1] === 3)).toBe(true);
    expect(h.sends.map((s) => s.data.mode)).toEqual(['image']);
  });

  it('refuses when no credits are left (409) and never emits', async () => {
    h.db = db(0);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(409);
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });

  it('refuses (409) when the compare-and-swap loses a race', async () => {
    h.casResult = []; // another request already spent it
    h.db = db(2);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(409);
    expect(h.sends).toHaveLength(0);
  });
});
