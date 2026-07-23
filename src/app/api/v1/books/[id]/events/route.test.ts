import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const post = (b: unknown) => POST(new Request(`https://m/api/v1/books/${ID}/events`, { method: 'POST', body: JSON.stringify(b) }), ctx);

describe('POST /books/:id/events (integration)', () => {
  beforeEach(() => { h.db = makeSupabase({ tables: { books: { data: { id: ID, parent_id: 'p1', deleted_at: null } } } }); });

  it('records a known event for the owner', async () => {
    const res = await post({ event: 'preview_viewed', metadata: { pageCount: 8 } });
    expect(res.status).toBe(201);
    expect(findOp(h.db!, 'book_events', 'insert')?.values).toMatchObject({ event: 'preview_viewed', book_id: ID });
  });

  it('rejects an unknown event name', async () => {
    const res = await post({ event: 'totally_made_up' });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'book_events', 'insert')).toBeUndefined();
  });

  it('forbids logging events on another parent’s book', async () => {
    h.db = makeSupabase({ tables: { books: { data: { id: ID, parent_id: 'other', deleted_at: null } } } });
    const res = await post({ event: 'preview_viewed' });
    expect(res.status).toBe(403);
  });
});
