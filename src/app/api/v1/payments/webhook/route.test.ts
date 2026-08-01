import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  signatureOk: true,
  sends: [] as { name: string; data: unknown }[],
  alerts: [] as unknown[],
  /** Whether the journal insert reports this event id as already seen. */
  eventSeen: false,
  refundResult: { applied: true, outcome: { alreadyReleased: false, fulfillmentCancelled: true } } as unknown,
  refundCalls: [] as unknown[],
}));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/razorpay', () => ({ verifyWebhookSignature: () => h.signatureOk }));
vi.mock('@/server/lib/email', () => ({
  sendAdminAlert: async (...a: unknown[]) => { h.alerts.push(a); },
  sendOrderReceived: async () => {},
}));
vi.mock('@/server/lib/refunds', () => ({
  applyRefundForPayment: async (a: unknown) => { h.refundCalls.push(a); return h.refundResult; },
}));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { fulfillmentRequested: 'book/fulfillment.requested' },
  inngest: { send: async (e: { name: string; data: unknown }) => { h.sends.push(e); } },
}));

import { POST } from './route';

function captured(amount: number, currency = 'INR', eventId = 'evt_1') {
  return new Request('https://m/api/v1/payments/webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': eventId },
    body: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'rzp_1', status: 'captured', amount, currency } } } }),
  });
}

function refunded(eventId = 'evt_r1') {
  return new Request('https://m/api/v1/payments/webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': eventId },
    body: JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 99900 } } } }),
  });
}

/** The journal answers "have I seen this event id?" from h.eventSeen. */
const journal = () => ({
  webhook_events: (op: string) =>
    op === 'insert' && h.eventSeen ? { error: { code: '23505', message: 'duplicate key' } } : { data: null },
});

const ORDER = { id: 'o1', parent_id: 'p1', book_id: 'b1', tier: 'print', amount: 99900, currency: 'INR', status: 'created' };

describe('POST /api/v1/payments/webhook (integration)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.SUPABASE_ANON_KEY = 'k';
  });
  beforeEach(() => {
    h.signatureOk = true; h.sends = []; h.alerts = []; h.eventSeen = false; h.refundCalls = [];
    h.refundResult = { applied: true, outcome: { alreadyReleased: false, fulfillmentCancelled: true } };
  });

  it('rejects a bad signature before touching the DB', async () => {
    h.signatureOk = false;
    h.db = makeSupabase({});
    const res = await POST(captured(99900));
    expect(res.status).toBe(400);
    expect(h.db.ops).toHaveLength(0);
  });

  it('activates a correct payment: marks paid, grants credits, stamps series, emits fulfilment', async () => {
    let bookRead = 0;
    h.db = makeSupabase({
      userEmail: 'parent@example.com',
      tables: {
        ...journal(),
        // The conditional activation reports one row moved — this delivery won.
        orders: (op) => (op === 'select' ? { data: ORDER } : { data: [{ id: 'o1' }] }),
        payments: { error: null },
        books: (op, ctx) => {
          if (op === 'update') return { data: null };
          if (ctx.head) return { count: 2 }; // prior purchases → series 3
          bookRead += 1;
          return bookRead === 1 ? { data: { hero_id: 'hero-1' } } : { data: { status: 'generating' } };
        },
      },
    });
    const res = await POST(captured(99900, 'INR'));
    expect(res.status).toBe(200);
    const upd = findOp(h.db, 'books', 'update');
    expect(upd?.values).toMatchObject({ status: 'paid', purchased_tier: 'print', render_credits: 3, series_number: 3 });
    expect(h.sends.map((s) => s.name)).toContain('book/fulfillment.requested');
  });

  // Two deliveries arriving together both saw status 'created' under the old
  // read-then-write, and both stamped the series number and sent a receipt.
  it('does not double-activate when a concurrent delivery already won', async () => {
    h.db = makeSupabase({
      tables: {
        ...journal(),
        // Zero rows moved: someone else flipped the order first.
        orders: (op) => (op === 'select' ? { data: ORDER } : { data: [] }),
        payments: { error: null },
        books: { data: { status: 'generating' } },
      },
    });
    const res = await POST(captured(99900, 'INR', 'evt_2'));
    expect(res.status).toBe(200);
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    // Fulfilment is still self-healed — that part is meant to be idempotent.
    expect(h.sends.map((s) => s.name)).toContain('book/fulfillment.requested');
  });

  // Distinguishing "someone else won the race" (0 rows) from "the update failed"
  // (an error) is the difference between a harmless no-op and a customer who is
  // charged, gets no receipt, and whose book never reaches the print queue —
  // while we return 200 so Razorpay never retries.
  it('fails loudly when the activation update errors, rather than assuming a race', async () => {
    h.db = makeSupabase({
      tables: {
        ...journal(),
        orders: (op) => (op === 'select' ? { data: ORDER } : { error: { message: 'statement timeout' } }),
        payments: { error: null },
        books: { data: { status: 'generating' } },
      },
    });
    const res = await POST(captured(99900, 'INR', 'evt_err'));
    expect(res.status).toBe(500);
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
  });

  it('does NOT activate on an amount mismatch — records it and alerts a human', async () => {
    h.db = makeSupabase({ tables: { ...journal(), orders: (op) => (op === 'select' ? { data: ORDER } : { data: null }), payments: { error: null }, books: { data: null } } });
    const res = await POST(captured(50000, 'INR')); // wrong amount
    expect(res.status).toBe(200);
    const pay = findOp(h.db, 'payments', 'insert');
    expect(pay?.values.status).toBe('amount_mismatch');
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    expect(h.alerts.length).toBe(1);
    expect(h.sends).toHaveLength(0);
  });

  it('treats a currency mismatch as a mismatch even when the amount matches', async () => {
    h.db = makeSupabase({ tables: { ...journal(), orders: (op) => (op === 'select' ? { data: ORDER } : { data: null }), payments: { error: null }, books: { data: null } } });
    const res = await POST(captured(99900, 'USD'));
    expect(res.status).toBe(200);
    expect(findOp(h.db, 'payments', 'insert')?.values.status).toBe('amount_mismatch');
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
  });

  // Razorpay redelivers events. Deduplication used to rest entirely on the
  // payment id, which only catches a repeat of the same payment — a redelivered
  // event of any other type was processed again.
  it('ignores a redelivered event by its event id, before touching anything', async () => {
    h.eventSeen = true;
    h.db = makeSupabase({ tables: journal() });
    const res = await POST(captured(99900));
    expect(await res.json()).toMatchObject({ deduped: true });
    expect(findOp(h.db, 'orders', 'select')).toBeUndefined();
    expect(h.sends).toHaveLength(0);
  });

  // Real money we cannot attribute used to produce a bare 404, which Razorpay
  // retried into the void: no alert, no audit row, not even a Sentry capture.
  it('dead-letters a captured payment with no matching order, and alerts', async () => {
    h.db = makeSupabase({ tables: { ...journal(), orders: { data: null }, webhook_events: { data: null } } });
    const res = await POST(captured(99900));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ unmatchedOrder: true });
    expect(h.alerts.length).toBe(1);
  });

  // Recording completion before handling turned Razorpay's redelivery — the
  // mechanism that exists to recover a failed handler — into a silent no-op.
  it('journals an event as received, and only marks it processed once handled', async () => {
    let bookRead = 0;
    h.db = makeSupabase({
      userEmail: 'parent@example.com',
      tables: {
        ...journal(),
        orders: (op) => (op === 'select' ? { data: ORDER } : { data: [{ id: 'o1' }] }),
        payments: { error: null },
        books: (op, ctx) => {
          if (op === 'update') return { data: null };
          if (ctx.head) return { count: 0 };
          bookRead += 1;
          return bookRead === 1 ? { data: { hero_id: 'h1' } } : { data: { status: 'generating' } };
        },
      },
    });
    await POST(captured(99900, 'INR', 'evt_j'));
    expect(findOp(h.db, 'webhook_events', 'insert')?.values).toMatchObject({ status: 'received' });
    expect(findOp(h.db, 'webhook_events', 'update')?.values).toMatchObject({ status: 'processed' });
  });

  it('applies a refund through the shared path', async () => {
    h.db = makeSupabase({ tables: journal() });
    const res = await POST(refunded());
    expect(res.status).toBe(200);
    expect(h.refundCalls).toEqual([expect.objectContaining({ razorpayPaymentId: 'pay_1', refundId: 'rfnd_1' })]);
  });

  // Out of order: a refund whose capture has not landed. Dropping it meant the
  // later capture would mark the order paid and print a refunded book.
  it('defers a refund that arrives before its capture instead of dropping it', async () => {
    h.refundResult = { applied: false, reason: 'unknown_payment' };
    h.db = makeSupabase({ tables: journal() });
    const res = await POST(refunded());
    expect(await res.json()).toMatchObject({ deferred: true });
    const parked = findOp(h.db, 'webhook_events', 'update');
    expect(parked?.values).toMatchObject({ status: 'deferred' });
  });

  it('escalates a refund on a book already at the printer', async () => {
    h.refundResult = { applied: true, outcome: { alreadyReleased: true, fulfillmentCancelled: false } };
    h.db = makeSupabase({ tables: journal() });
    const res = await POST(refunded());
    expect(await res.json()).toMatchObject({ alreadyReleased: true });
  });

  it('is idempotent: a duplicate payment for an already-complete book does not re-fulfil', async () => {
    h.db = makeSupabase({
      tables: {
        ...journal(),
        orders: (op) => (op === 'select' ? { data: { ...ORDER, status: 'paid' } } : { data: null }),
        payments: { error: { code: '23505', message: 'duplicate key' } },
        books: { data: { status: 'complete' } },
      },
    });
    const res = await POST(captured(99900));
    expect(res.status).toBe(200);
    expect(h.sends).toHaveLength(0); // book already complete → no fulfilment emit
  });
});
