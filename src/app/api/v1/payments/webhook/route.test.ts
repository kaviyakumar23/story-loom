import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  signatureOk: true,
  sends: [] as { name: string; data: unknown }[],
  alerts: [] as unknown[],
}));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/razorpay', () => ({ verifyWebhookSignature: () => h.signatureOk }));
vi.mock('@/server/lib/email', () => ({
  sendAdminAlert: async (...a: unknown[]) => { h.alerts.push(a); },
  sendOrderReceived: async () => {},
}));
vi.mock('@/server/pipeline/client', () => ({
  EVENTS: { fulfillmentRequested: 'book/fulfillment.requested' },
  inngest: { send: async (e: { name: string; data: unknown }) => { h.sends.push(e); } },
}));

import { POST } from './route';

function captured(amount: number, currency = 'INR') {
  return new Request('https://m/api/v1/payments/webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'sig' },
    body: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'rzp_1', status: 'captured', amount, currency } } } }),
  });
}

const ORDER = { id: 'o1', parent_id: 'p1', book_id: 'b1', tier: 'print', amount: 99900, currency: 'INR', status: 'created' };

describe('POST /api/v1/payments/webhook (integration)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    process.env.SUPABASE_ANON_KEY = 'k';
  });
  beforeEach(() => { h.signatureOk = true; h.sends = []; h.alerts = []; });

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
        orders: (op) => (op === 'select' ? { data: ORDER } : { data: null }),
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

  it('does NOT activate on an amount mismatch — records it and alerts a human', async () => {
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: ORDER } : { data: null }), payments: { error: null }, books: { data: null } } });
    const res = await POST(captured(50000, 'INR')); // wrong amount
    expect(res.status).toBe(200);
    const pay = findOp(h.db, 'payments', 'insert');
    expect(pay?.values.status).toBe('amount_mismatch');
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
    expect(h.alerts.length).toBe(1);
    expect(h.sends).toHaveLength(0);
  });

  it('treats a currency mismatch as a mismatch even when the amount matches', async () => {
    h.db = makeSupabase({ tables: { orders: (op) => (op === 'select' ? { data: ORDER } : { data: null }), payments: { error: null }, books: { data: null } } });
    const res = await POST(captured(99900, 'USD'));
    expect(res.status).toBe(200);
    expect(findOp(h.db, 'payments', 'insert')?.values.status).toBe('amount_mismatch');
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
  });

  it('is idempotent: a duplicate payment for an already-complete book does not re-fulfil', async () => {
    h.db = makeSupabase({
      tables: {
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
