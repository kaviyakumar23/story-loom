import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  enabled: 'true',
  physical: true,
  rzpCalls: 0,
}));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ NEXT_PUBLIC_PAYMENTS_ENABLED: h.enabled, RAZORPAY_KEY_ID: 'key_123' }) }));
vi.mock('@/server/config/pricing', () => ({ priceFor: () => ({ enabled: true, physical: h.physical, amount: 99900, currency: 'INR' }) }));
vi.mock('@/server/auth', () => ({ requireParent: async () => ({ id: 'p1' }) }));
vi.mock('@/server/lib/rate-limit', () => ({ assertRateLimit: () => {} }));
vi.mock('@/server/lib/razorpay', () => ({
  createOrder: async () => { h.rzpCalls += 1; return { id: 'rzp_1', amount: 99900, currency: 'INR' }; },
}));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { POST } from './route';

const BOOK = '11111111-1111-4111-8111-111111111111';
const ADDRESS = { recipientName: 'Grandma', phone: '9876543210', line1: '1 St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' };
const post = (b: unknown) => POST(new Request('https://m/api/v1/payments/order', { method: 'POST', body: JSON.stringify(b) }));

const DUPLICATE = { code: '23505', message: 'duplicate key value violates unique constraint "uq_orders_open_per_book"' };

function orderDb(over: { bookStatus?: string } = {}) {
  return makeSupabase({
    tables: {
      books: { data: { id: BOOK, parent_id: 'p1', status: over.bookStatus ?? 'preview_ready', deleted_at: null } },
      orders: (op) => (op === 'insert' ? { data: { id: 'o1', razorpay_order_id: null, amount: 99900, currency: 'INR' } } : { data: null }),
      shipping_addresses: { data: null },
    },
  });
}

/** The database refuses the second open order; the route has to cope. */
function racedDb(existing: Record<string, unknown>) {
  return makeSupabase({
    tables: {
      books: { data: { id: BOOK, parent_id: 'p1', status: 'preview_ready', deleted_at: null } },
      orders: (op) => (op === 'insert' ? { error: DUPLICATE } : { data: existing }),
      shipping_addresses: { data: null },
    },
  });
}

describe('POST /api/v1/payments/order (integration)', () => {
  beforeEach(() => { h.enabled = 'true'; h.physical = true; h.rzpCalls = 0; h.db = orderDb(); });

  it('is 403 when payments are disabled (server-side kill switch)', async () => {
    h.enabled = 'false';
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(403);
  });

  it('requires a shipping address for a physical order', async () => {
    const res = await post({ bookId: BOOK, tier: 'print' });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'orders', 'insert')).toBeUndefined();
  });

  it('creates a server-priced order + shipping row and returns the Razorpay handle', async () => {
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ razorpayOrderId: 'rzp_1', amount: 99900, keyId: 'key_123' });
    expect(findOp(h.db!, 'orders', 'insert')?.values).toMatchObject({ amount: 99900, currency: 'INR', is_gift: false });
    expect(findOp(h.db!, 'shipping_addresses', 'upsert')?.values).toMatchObject({ recipient_name: 'Grandma', postal_code: '411001' });
  });

  it('persists a gift flag + message', async () => {
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS, isGift: true, giftMessage: 'With love' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'orders', 'insert')?.values).toMatchObject({ is_gift: true, gift_message: 'With love' });
  });

  // The double-click case. Two payable Razorpay orders for one book meant the
  // customer could be charged twice with no automatic remedy, so losing the race
  // has to converge on the winner rather than create a second order.
  it('returns the existing Razorpay order when a concurrent request won the race', async () => {
    h.db = racedDb({ id: 'o1', razorpay_order_id: 'rzp_1', amount: 99900, currency: 'INR', parent_id: 'p1' });
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ razorpayOrderId: 'rzp_1' });
    // Crucially: no SECOND Razorpay order was created.
    expect(h.rzpCalls).toBe(0);
  });

  it('finishes linking a Razorpay order the winning request had not yet created', async () => {
    h.db = racedDb({ id: 'o1', razorpay_order_id: null, amount: 99900, currency: 'INR', parent_id: 'p1' });
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(200);
    expect(h.rzpCalls).toBe(1);
    expect(findOp(h.db!, 'orders', 'update')?.values).toMatchObject({ razorpay_order_id: 'rzp_1' });
  });

  it('refuses when the open order is for a different price', async () => {
    h.db = racedDb({ id: 'o1', razorpay_order_id: 'rzp_1', amount: 129900, currency: 'INR', parent_id: 'p1' });
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(409);
    expect(h.rzpCalls).toBe(0);
  });

  it('refuses to take money for a book that is not previewed yet', async () => {
    h.db = orderDb({ bookStatus: 'generating' });
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(409);
    expect(findOp(h.db!, 'orders', 'insert')).toBeUndefined();
  });

  it('refuses to sell the same book twice', async () => {
    h.db = orderDb({ bookStatus: 'complete' });
    const res = await post({ bookId: BOOK, tier: 'print', shippingAddress: ADDRESS });
    expect(res.status).toBe(409);
    expect(h.rzpCalls).toBe(0);
  });
});
