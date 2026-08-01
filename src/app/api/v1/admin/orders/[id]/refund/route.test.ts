import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, refunds: 0, applied: [] as unknown[], alreadyReleased: false }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/razorpay', () => ({ refundPayment: async () => { h.refunds += 1; return { id: 'rfnd_1', amount: 99900 }; } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
// The refund's effect on the book (cancel fulfilment, take it out of 'paid') is
// covered in refunds.test.ts; here we assert this route calls it at all.
vi.mock('@/server/lib/refunds', () => ({
  applyRefundForPayment: async (a: unknown) => {
    h.applied.push(a);
    return { applied: true, outcome: { alreadyReleased: h.alreadyReleased, fulfillmentCancelled: !h.alreadyReleased } };
  },
}));

import { POST } from './route';

const ID = '11111111-1111-4111-8111-111111111111';
const run = () => POST(new Request(`https://m/api/v1/admin/orders/${ID}/refund`, { method: 'POST' }), { params: Promise.resolve({ id: ID }) });

describe('POST /admin/orders/:id/refund (integration)', () => {
  beforeEach(() => { h.refunds = 0; h.applied = []; h.alreadyReleased = false; });

  it('refunds a paid order and stops the book', async () => {
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: { id: ID, status: 'paid', amount: 99900 } } : { data: null }), payments: { data: { razorpay_payment_id: 'pay_1' } } } });
    const res = await run();
    expect(res.status).toBe(200);
    expect(h.refunds).toBe(1);
    // Marking the order refunded is not enough on its own — the fulfilment has
    // to be cancelled in the same breath, which is what applyRefundForPayment does.
    expect(h.applied).toEqual([expect.objectContaining({ razorpayPaymentId: 'pay_1', refundId: 'rfnd_1' })]);
  });

  // An order can hold a failed attempt AND a capture. maybeSingle() errored on
  // two rows and the error was discarded, so refunding a customer whose card had
  // failed once was impossible.
  it('picks the captured payment, not a failed earlier attempt', async () => {
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: { id: ID, status: 'paid', amount: 99900 } } : { data: null }), payments: { data: { razorpay_payment_id: 'pay_captured' } } } });
    const res = await run();
    expect(res.status).toBe(200);
    const filters = findOp(h.db!, 'payments', 'select')?.filters ?? [];
    expect(filters).toContainEqual({ m: 'eq', args: ['status', 'captured'] });
  });

  it('reports when the book had already gone to the printer', async () => {
    h.alreadyReleased = true;
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: { id: ID, status: 'paid', amount: 99900 } } : { data: null }), payments: { data: { razorpay_payment_id: 'pay_1' } } } });
    const res = await run();
    expect(await res.json()).toMatchObject({ alreadyReleased: true });
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
