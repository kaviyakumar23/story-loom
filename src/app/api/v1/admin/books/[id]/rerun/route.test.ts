import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, admin: true, sends: [] as { name: string }[] }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => { if (!h.admin) throw Object.assign(new Error('forbidden'), { statusCode: 403 }); } }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { fulfillmentRequested: 'book/fulfillment.requested', previewRequested: 'book/preview.requested' },
  inngest: { send: async (e: { name: string }) => { h.sends.push(e); } },
}));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const run = () => POST(new Request(`https://m/api/v1/admin/books/${ID}/rerun`, { method: 'POST' }), { params: Promise.resolve({ id: ID }) });

describe('POST /admin/books/:id/rerun (integration)', () => {
  beforeEach(() => { h.admin = true; h.sends = []; });

  it('re-runs the FULFILMENT phase for a purchased book', async () => {
    h.db = makeSupabase({ tables: { books: (op) => (op === 'select' ? { data: { id: 'b1', purchased_tier: 'print' } } : { data: null }) } });
    const res = await run();
    expect(await res.json()).toMatchObject({ phase: 'fulfillment' });
    expect(h.sends.map((s) => s.name)).toEqual(['book/fulfillment.requested']);
  });

  it('re-runs the PREVIEW phase for an unpurchased book', async () => {
    h.db = makeSupabase({ tables: { books: (op) => (op === 'select' ? { data: { id: 'b1', purchased_tier: null } } : { data: null }) } });
    const res = await run();
    expect(await res.json()).toMatchObject({ phase: 'preview' });
    expect(h.sends.map((s) => s.name)).toEqual(['book/preview.requested']);
  });

  it('404s an unknown book', async () => {
    h.db = makeSupabase({ tables: { books: { data: null } } });
    const res = await run();
    expect(res.status).toBe(404);
    expect(h.sends).toHaveLength(0);
  });
});
