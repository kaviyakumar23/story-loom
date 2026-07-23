import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, refunds: 0 }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/razorpay', () => ({ refundPayment: async () => { h.refunds += 1; return { id: 'rfnd_1', amount: 99900 }; } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const run = () => POST(new Request(`https://m/api/v1/admin/orders/${ID}/refund`, { method: 'POST' }), { params: Promise.resolve({ id: ID }) });

describe('POST /admin/orders/:id/refund (integration)', () => {
  beforeEach(() => { h.refunds = 0; });

  it('refunds a paid order and marks it refunded', async () => {
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: { id: ID, status: 'paid', amount: 99900 } } : { data: null }), payments: { data: { razorpay_payment_id: 'pay_1' } } } });
    const res = await run();
    expect(res.status).toBe(200);
    expect(h.refunds).toBe(1);
    expect(findOp(h.db!, 'orders', 'update')?.values).toMatchObject({ status: 'refunded' });
  });

  it('is a no-op for an already-refunded order (no double refund)', async () => {
    h.db = makeSupabase({ tables: { orders: { data: { id: ID, status: 'refunded', amount: 99900 } } } });
    const res = await run();
    expect(await res.json()).toMatchObject({ alreadyRefunded: true });
    expect(h.refunds).toBe(0);
  });

  it('refuses to refund an unpaid order', async () => {
    h.db = makeSupabase({ tables: { orders: { data: { id: ID, status: 'created', amount: 99900 } } } });
    const res = await run();
    expect(res.status).toBe(400);
    expect(h.refunds).toBe(0);
  });
});
