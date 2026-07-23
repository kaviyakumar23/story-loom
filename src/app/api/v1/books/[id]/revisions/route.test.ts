import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, count: 0, sends: [] as { name: string }[] }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/pipeline/client', () => ({ EVENTS: { previewRequested: 'book/preview.requested' }, inngest: { send: async (e: { name: string }) => { h.sends.push(e); } } }));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const post = () => POST(new Request(`https://m/api/v1/books/${ID}/revisions`, { method: 'POST', body: JSON.stringify({ instruction: 'make it calmer please' }) }), ctx);

function db(status: string) {
  return makeSupabase({
    tables: {
      books: (op, c) => {
        if (op === 'update') return { data: null };
        if (c.head) return { count: h.count }; // revision count
        return { data: { id: 'b1', parent_id: 'p1', status, deleted_at: null } };
      },
      book_revision_requests: (op, c) => (c.head ? { count: h.count } : { data: { id: 'rev1' } }),
    },
  });
}

describe('POST /books/:id/revisions — one free tweak (integration)', () => {
  beforeEach(() => { h.count = 0; h.sends = []; });

  it('accepts the first tweak, resets to generating, and re-runs preview', async () => {
    h.db = db('preview_ready');
    const res = await post();
    expect(res.status).toBe(202);
    expect(findOp(h.db!, 'books', 'update')?.values).toMatchObject({ status: 'generating' });
    expect(h.sends.map((s) => s.name)).toEqual(['book/preview.requested']);
  });

  it('409s the second tweak (already used its one free revision)', async () => {
    h.count = 1;
    h.db = db('preview_ready');
    const res = await post();
    expect(res.status).toBe(409);
    expect(h.sends).toHaveLength(0);
  });

  it('refuses a tweak outside preview_ready', async () => {
    h.db = db('complete');
    const res = await post();
    expect(res.status).toBe(400);
    expect(h.sends).toHaveLength(0);
  });
});
