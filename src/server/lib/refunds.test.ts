import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * A refund has to stop the book, not just relabel the order.
 *
 * Before this, refunding changed two status columns that nothing read:
 * generation kept running, the print queue kept advancing, and the reconcile
 * cron re-enqueued the book because `books.status` was still 'paid'. The work
 * moved into one database transaction, so these tests assert that the route
 * actually calls it and handles what it reports.
 */
const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  alerts: [] as unknown[],
  rpcResult: { already_released: false, fulfillment_cancelled: true } as unknown,
}));

vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/email', () => ({ sendAdminAlert: async (...a: unknown[]) => { h.alerts.push(a); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { applyRefundForPayment } from './refunds';

const call = () => applyRefundForPayment({ razorpayPaymentId: 'pay_1', refundId: 'rfnd_1', amount: 99900 });

function db(payment: Record<string, unknown> | null) {
  return makeSupabase({
    tables: { payments: { data: payment }, orders: { data: null } },
    rpc: { apply_refund: () => ({ data: h.rpcResult }) },
  });
}

describe('applyRefundForPayment', () => {
  beforeEach(() => {
    h.alerts = [];
    h.rpcResult = { already_released: false, fulfillment_cancelled: true };
  });

  it('runs the refund transaction and marks the payment refunded', async () => {
    h.db = db({ id: 'pmt1', order_id: 'o1', status: 'captured' });
    const result = await call();
    expect(result).toMatchObject({ applied: true, outcome: { fulfillmentCancelled: true, alreadyReleased: false } });
    expect(h.db.rpcCalls).toEqual([['apply_refund', { p_order: 'o1' }]]);
  });

  // Out of order: the refund overtook its own capture. Dropping it here meant a
  // later capture would mark the order paid and send a refunded book to print.
  it('reports an unknown payment so the caller can park the event', async () => {
    h.db = db(null);
    expect(await call()).toEqual({ applied: false, reason: 'unknown_payment' });
    expect(h.db.rpcCalls).toHaveLength(0);
  });

  it('is a no-op on a payment already refunded', async () => {
    h.db = db({ id: 'pmt1', order_id: 'o1', status: 'refunded' });
    expect(await call()).toEqual({ applied: false, reason: 'already_refunded' });
    expect(h.db.rpcCalls).toHaveLength(0);
  });

  // Software cannot recall a file from a press, so the only useful response is
  // to make sure a person finds out quickly.
  it('alerts a human when the book had already gone to the printer', async () => {
    h.rpcResult = { already_released: true, fulfillment_cancelled: false };
    h.db = db({ id: 'pmt1', order_id: 'o1', status: 'captured' });
    const result = await call();
    expect(result).toMatchObject({ applied: true, outcome: { alreadyReleased: true } });
    expect(h.alerts).toHaveLength(1);
  });

  it('does not alert when the fulfilment was cancelled in time', async () => {
    h.db = db({ id: 'pmt1', order_id: 'o1', status: 'captured' });
    await call();
    expect(h.alerts).toHaveLength(0);
  });
});
