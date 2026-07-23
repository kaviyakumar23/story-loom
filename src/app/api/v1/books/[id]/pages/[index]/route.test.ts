import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb, type TableConfig } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  moderationAllowed: true,
  sends: [] as { name: string; data: { mode?: string } }[],
}));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/providers/index', () => ({
  getProviders: () => ({ moderator: { moderateText: async () => ({ allowed: h.moderationAllowed, reasons: h.moderationAllowed ? [] : ['self_harm'] }) } }),
}));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { editApplied: 'book/edit.applied' },
  inngest: { send: async (e: { name: string; data: { mode?: string } }) => { h.sends.push(e); } },
}));

import { PATCH } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID, index: '0' }) };
const req = (text: string) => new Request(`https://m/api/v1/books/${ID}/pages/0`, { method: 'PATCH', body: JSON.stringify({ text }) });

/** A book in the editable window (complete, no print started) with an existing page. */
function editableDb(overrides: TableConfig = {}) {
  return makeSupabase({
    tables: {
      books: (op) => (op === 'select' ? { data: { id: 'b1', parent_id: 'p1', status: 'complete', purchased_tier: 'print', render_credits: 3, deleted_at: null } } : { data: null }),
      fulfillments: { data: { status: 'print_ready' } },
      book_pages: (op) => (op === 'select' ? { data: { page_index: 0 } } : { data: null }),
      ...overrides,
    },
  });
}

describe('PATCH /books/:id/pages/:index — text edit (integration)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.SUPABASE_ANON_KEY = 'k';
  });
  beforeEach(() => { h.moderationAllowed = true; h.sends = []; });

  it('saves an edit, marks the book re-assembling, and emits a text edit', async () => {
    h.db = editableDb();
    const res = await PATCH(req('A gentler new line for this page.'), ctx);
    expect(res.status).toBe(202);
    expect(findOp(h.db, 'book_pages', 'update')?.values).toMatchObject({ text: 'A gentler new line for this page.' });
    expect(findOp(h.db, 'books', 'update')?.values).toHaveProperty('editing_at');
    expect(h.sends.map((s) => s.data.mode)).toEqual(['text']);
  });

  it('fails closed on blocked content — no write, no emit', async () => {
    h.moderationAllowed = false;
    h.db = editableDb();
    const res = await PATCH(req('something that should be blocked'), ctx);
    expect(res.status).toBe(400);
    expect(findOp(h.db, 'book_pages', 'update')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });

  it('refuses to edit a book that is not complete yet', async () => {
    h.db = editableDb({ books: (op) => (op === 'select' ? { data: { id: 'b1', parent_id: 'p1', status: 'paid', purchased_tier: 'print', render_credits: 0, deleted_at: null } } : { data: null }) });
    const res = await PATCH(req('too early to edit'), ctx);
    expect(res.status).toBe(400);
    expect(h.sends).toHaveLength(0);
  });

  it('closes the window once a physical order is printing (409)', async () => {
    h.db = editableDb({ fulfillments: { data: { status: 'printing' } } });
    const res = await PATCH(req('changed my mind after printing'), ctx);
    expect(res.status).toBe(409);
    expect(findOp(h.db, 'book_pages', 'update')).toBeUndefined();
  });
});
