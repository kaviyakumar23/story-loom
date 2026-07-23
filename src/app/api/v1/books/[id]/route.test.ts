import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { DELETE, GET } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const generatingRow = (over: Record<string, unknown> = {}) => ({
  id: ID, status: 'generating', progress: 20, goal: 'reading_confidence', occasion_pack: null, language: 'en',
  reading_level: 'early', title: null, theme: null, purchased_tier: null, cover_asset_id: null, error: null,
  created_at: '2026-07-01', updated_at: '2026-07-01', render_credits: 0, editing_at: null, parent_id: 'p1', deleted_at: null, ...over,
});

describe('GET/DELETE /api/v1/books/:id (integration)', () => {
  beforeEach(() => { h.db = null; });

  it('GET returns the owner’s book', async () => {
    h.db = makeSupabase({ tables: { books: { data: generatingRow() }, book_revision_requests: (_op, c) => (c.head ? { count: 0 } : { data: null }) } });
    const res = await GET(new Request(`https://m/api/v1/books/${ID}`), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: ID, status: 'generating' });
  });

  it('GET forbids another parent’s book', async () => {
    h.db = makeSupabase({ tables: { books: { data: generatingRow({ parent_id: 'other' }) } } });
    const res = await GET(new Request(`https://m/api/v1/books/${ID}`), ctx);
    expect(res.status).toBe(403);
  });

  it('GET 404s a soft-deleted book', async () => {
    h.db = makeSupabase({ tables: { books: { data: generatingRow({ deleted_at: '2026-07-02' }) } } });
    const res = await GET(new Request(`https://m/api/v1/books/${ID}`), ctx);
    expect(res.status).toBe(404);
  });

  it('DELETE soft-deletes the book (204)', async () => {
    h.db = makeSupabase({ tables: { books: (op) => (op === 'select' ? { data: generatingRow() } : { data: null }) } });
    const res = await DELETE(new Request(`https://m/api/v1/books/${ID}`, { method: 'DELETE' }), ctx);
    expect(res.status).toBe(204);
    expect(findOp(h.db!, 'books', 'update')?.values).toHaveProperty('deleted_at');
  });
});
