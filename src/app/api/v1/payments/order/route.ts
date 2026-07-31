import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { priceFor } from '@/server/config/pricing';
import { requireParent } from '@/server/auth';
import { badRequest, conflict, forbidden, internal, notFound } from '@/server/lib/errors';
import { createOrder } from '@/server/lib/razorpay';
import { assertRateLimit } from '@/server/lib/rate-limit';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { isPdfSafe } from '@/server/lib/text';
import { TIERS, type CreateOrderResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,14}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().trim().default('IN'),
  notes: z.string().trim().max(300).optional(),
});
const orderSchema = z.object({
  bookId: z.string().uuid(),
  tier: z.enum(TIERS),
  shippingAddress: addressSchema.optional(),
  isGift: z.boolean().optional(),
  // Printed on the closing bookplate, so it must be PDF-encodable.
  giftMessage: z
    .string()
    .trim()
    .max(200)
    .refine(isPdfSafe, { message: 'The gift message can only use Latin letters and common punctuation for now.' })
    .optional(),
});

// ---- POST /api/v1/payments/order — server-priced Razorpay order (§8) ----
//
// Idempotent per book. A parent who double-clicks, or a client that retries a
// request that actually succeeded, used to get a SECOND payable Razorpay order:
// nothing looked for an existing one and nothing in the schema forbade it, so
// both could be paid and the customer charged twice with no automatic remedy.
// One open order per book is now enforced in the database, and a losing race
// returns the order that won rather than an error — converging is the correct
// answer to "I clicked twice", not a failure.
export async function POST(req: Request): Promise<Response> {
  try {
    // Server-side kill switch — the client flag only hides the buy button.
    if (loadEnv().NEXT_PUBLIC_PAYMENTS_ENABLED !== 'true') {
      throw forbidden('Payments are not enabled');
    }
    const parent = await requireParent(req);
    // Bounds a burst before it reaches Razorpay; the unique index is what makes
    // the outcome correct, this just keeps the noise down.
    assertRateLimit(`order:${parent.id}`, 5, 60_000);
    const parsed = orderSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid order payload', parsed.error.issues);
    const { bookId, tier } = parsed.data;
    const db = serviceClient();

    const { data: book } = await db
      .from('books')
      .select('id, parent_id, status, deleted_at')
      .eq('id', bookId)
      .maybeSingle();
    const bookRow = book as { parent_id: string; status: string; deleted_at: string | null } | null;
    if (!bookRow || bookRow.deleted_at) throw notFound('Book not found');
    if (bookRow.parent_id !== parent.id) throw forbidden();
    // Only a finished preview is buyable. Without this a book could be paid for
    // while still generating, or bought a second time after it was delivered.
    if (bookRow.status !== 'preview_ready') {
      throw conflict(
        bookRow.status === 'generating'
          ? 'Your preview is still being made — try again in a moment.'
          : 'This book has already been ordered.',
      );
    }

    // NEVER trust a client amount — price server-side from the tier.
    const price = priceFor(tier);
    if (!price.enabled) throw badRequest('This tier is not available yet');
    // A printed book cannot be created without somewhere to ship it.
    if (price.physical && !parsed.data.shippingAddress) {
      throw badRequest('A shipping address is required for a printed book');
    }
    const isGift = parsed.data.isGift === true;

    const { data: created, error: orderErr } = await db
      .from('orders')
      .insert({
        parent_id: parent.id,
        book_id: bookId,
        tier,
        amount: price.amount,
        currency: price.currency,
        status: 'created',
        is_gift: isGift,
        gift_message: isGift ? parsed.data.giftMessage ?? null : null,
      })
      .select('id, razorpay_order_id, amount, currency')
      .single();

    let order = created as { id: string; razorpay_order_id: string | null; amount: number; currency: string } | null;

    if (orderErr) {
      // uq_orders_open_per_book: someone already has an open (or paid) order for
      // this book — almost always this same parent, one click earlier.
      if (orderErr.code !== '23505') throw internal('Could not create order', orderErr.message);
      order = await loadOpenOrder(db, bookId, parent.id);
      if (!order) throw conflict('This book already has an order in progress.');
      // A tier change mid-flight would mean the Razorpay order no longer matches
      // what we are about to charge, so it needs an explicit restart.
      if (order.amount !== price.amount || order.currency !== price.currency) {
        throw conflict('There is already an order for this book at a different price. Refresh and try again.');
      }
    }
    if (!order) throw internal('Could not create order');

    // Persist the ship-to for physical tiers (parent-owned, RLS-scoped). Upsert,
    // so a retried checkout corrects the address instead of appending a second
    // row that nothing can choose between.
    if (price.physical && parsed.data.shippingAddress) {
      const a = parsed.data.shippingAddress;
      const { error: addrErr } = await db.from('shipping_addresses').upsert(
        {
          parent_id: parent.id,
          order_id: order.id,
          recipient_name: a.recipientName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          state: a.state,
          postal_code: a.postalCode,
          country: a.country,
          notes: a.notes ?? null,
        },
        { onConflict: 'order_id' },
      );
      if (addrErr) throw internal('Could not save shipping address', addrErr.message);
    }

    // Reuse the Razorpay order if this request lost the race — creating a second
    // one is exactly the double-charge the index exists to prevent.
    let razorpayOrderId = order.razorpay_order_id;
    if (!razorpayOrderId) {
      const rzp = await createOrder({
        amount: price.amount,
        currency: price.currency,
        receipt: order.id,
        notes: { orderId: order.id, bookId, tier },
      });
      razorpayOrderId = rzp.id;
      // Checked, unlike before: an unrecorded id makes the order unmatchable by
      // the webhook, which looks orders up by exactly this column.
      const { error: linkErr } = await db
        .from('orders')
        .update({ razorpay_order_id: rzp.id })
        .eq('id', order.id);
      if (linkErr) throw internal('Could not link the payment order', linkErr.message);
    }

    return Response.json({
      razorpayOrderId,
      amount: price.amount,
      currency: price.currency,
      keyId: loadEnv().RAZORPAY_KEY_ID,
    } satisfies CreateOrderResponse);
  } catch (err) {
    return jsonError(err);
  }
}

/** The one order this book is allowed to have open, if it already exists. */
async function loadOpenOrder(
  db: ReturnType<typeof serviceClient>,
  bookId: string,
  parentId: string,
): Promise<{ id: string; razorpay_order_id: string | null; amount: number; currency: string } | null> {
  const { data } = await db
    .from('orders')
    .select('id, razorpay_order_id, amount, currency, parent_id')
    .eq('book_id', bookId)
    .in('status', ['created', 'paid'])
    .maybeSingle();
  const row = data as
    | { id: string; razorpay_order_id: string | null; amount: number; currency: string; parent_id: string }
    | null;
  if (!row) return null;
  if (row.parent_id !== parentId) throw forbidden();
  return row;
}
