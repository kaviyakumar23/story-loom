import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, shipped: 0 }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ APP_BASE_URL: 'https://m' }) }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/email', () => ({ sendShipped: async () => { h.shipped += 1; } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { PATCH } from './route';

const ctx = { params: Promise.resolve({ id: 'f1' }) };
const patch = (body: unknown) => PATCH(new Request('https://m/api/v1/admin/fulfillments/f1', { method: 'PATCH', body: JSON.stringify(body) }), ctx);

/** A fulfillment currently in `status`, with an updated row + book owner ready. */
function fDb(status: string, tracking: string | null = null) {
  return makeSupabase({
    userEmail: 'parent@example.com',
    tables: {
      fulfillments: (op) => (op === 'select'
        ? { data: { id: 'f1', status, tracking_number: tracking, carrier: null, book_id: 'b1' } }
        : { data: { id: 'f1', status: 'shipped' } }),
      books: { data: { parent_id: 'p1' } },
    },
  });
}

describe('PATCH /admin/fulfillments/:id (integration)', () => {
  beforeEach(() => { h.shipped = 0; });

  it('advances a valid transition (print_ready → printing)', async () => {
    h.db = fDb('print_ready');
    const res = await patch({ status: 'printing' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'fulfillments', 'update')?.values).toMatchObject({ status: 'printing' });
  });

  it('refuses an illegal transition (print_ready → shipped)', async () => {
    h.db = fDb('print_ready');
    const res = await patch({ status: 'shipped', trackingNumber: 'TRK1' });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'fulfillments', 'update')).toBeUndefined();
  });

  it('requires a tracking number to mark shipped', async () => {
    h.db = fDb('printing');
    const res = await patch({ status: 'shipped' });
    expect(res.status).toBe(400);
  });

  it('marks shipped with tracking and emails the parent', async () => {
    h.db = fDb('printing');
    const res = await patch({ status: 'shipped', trackingNumber: 'TRK1', carrier: 'BlueDart' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'fulfillments', 'update')?.values).toMatchObject({ status: 'shipped', tracking_number: 'TRK1' });
    expect(h.shipped).toBe(1);
  });
});
