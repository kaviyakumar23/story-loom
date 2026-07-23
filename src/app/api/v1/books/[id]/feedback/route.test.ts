import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const post = (b: unknown) => POST(new Request(`https://m/api/v1/books/${ID}/feedback`, { method: 'POST', body: JSON.stringify(b) }), ctx);

describe('POST /books/:id/feedback (integration)', () => {
  beforeEach(() => { h.db = makeSupabase({ tables: { books: { data: { id: ID, parent_id: 'p1', deleted_at: null } } } }); });

  it('records valid feedback', async () => {
    const res = await post({ rating: 4, issueType: 'image_quality', comments: 'a bit blurry', wantsFullBook: true });
    expect(res.status).toBe(201);
    expect(findOp(h.db!, 'book_feedback', 'insert')?.values).toMatchObject({ rating: 4, issue_type: 'image_quality', wants_full_book: true });
  });

  it('rejects an out-of-range rating', async () => {
    const res = await post({ rating: 9 });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'book_feedback', 'insert')).toBeUndefined();
  });

  it('forbids leaving feedback on another parent’s book', async () => {
    h.db = makeSupabase({ tables: { books: { data: { id: ID, parent_id: 'other', deleted_at: null } } } });
    const res = await post({ rating: 5 });
    expect(res.status).toBe(403);
  });
});
