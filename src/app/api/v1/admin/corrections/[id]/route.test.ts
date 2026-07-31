import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * The founder's half of the correction flow. A parent's request is only an
 * intent until someone reads it: approving here is what actually rebuilds the
 * book, and declining closes it with a reason.
 */
const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  sends: [] as { name: string }[],
  claimed: [{ id: 'rev1' }] as { id: string }[],
}));

vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { previewRequested: 'book/preview.requested' },
  inngest: { send: async (e: { name: string }) => { h.sends.push(e); } },
}));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };
const post = (decision: string, note?: string) =>
  POST(new Request(`https://m/api/v1/admin/corrections/${ID}`, { method: 'POST', body: JSON.stringify({ decision, note }) }), ctx);

function db(status = 'pending_review') {
  return makeSupabase({
    tables: {
      book_revision_requests: (op) =>
        op === 'update' ? { data: h.claimed } : { data: { id: 'rev1', book_id: 'b1', status } },
      books: { data: null },
    },
  });
}

describe('POST /api/v1/admin/corrections/:id', () => {
  beforeEach(() => { h.sends = []; h.claimed = [{ id: 'rev1' }]; });

  it('approving queues the correction and restarts the preview', async () => {
    h.db = db();
    const res = await post('approve');
    expect(res.status).toBe(200);
    expect(findOp(h.db, 'book_revision_requests', 'update')?.values).toMatchObject({ status: 'queued' });
    expect(findOp(h.db, 'books', 'update')?.values).toMatchObject({ status: 'generating', progress: 0 });
    expect(h.sends.map((s) => s.name)).toEqual(['book/preview.requested']);
  });

  it('declining records the reason and rebuilds nothing', async () => {
    h.db = db();
    const res = await post('reject', 'We can’t add a real photo of your dog.');
    expect(res.status).toBe(200);
    expect(findOp(h.db, 'book_revision_requests', 'update')?.values).toMatchObject({
      status: 'rejected',
      review_note: 'We can’t add a real photo of your dog.',
    });
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });

  it('refuses a correction that was already reviewed', async () => {
    h.db = db('queued');
    const res = await post('approve');
    expect(res.status).toBe(409);
    expect(h.sends).toHaveLength(0);
  });

  // Two admins clicking approve at once must not queue the same rebuild twice —
  // the conditional update means only one of them claims the row.
  it('refuses when another reviewer already claimed the row', async () => {
    h.claimed = [];
    h.db = db();
    const res = await post('approve');
    expect(res.status).toBe(409);
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });
});
