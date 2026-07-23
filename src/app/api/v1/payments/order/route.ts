import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { priceFor } from '@/server/config/pricing';
import { requireParent } from '@/server/auth';
import { badRequest, forbidden, internal, notFound } from '@/server/lib/errors';
import { createOrder } from '@/server/lib/razorpay';
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
export async function POST(req: Request): Promise<Response> {
  try {
    // Server-side kill switch — the client flag only hides the buy button.
    if (loadEnv().NEXT_PUBLIC_PAYMENTS_ENABLED !== 'true') {
      throw forbidden('Payments are not enabled');
    }
    const parent = await requireParent(req);
    const parsed = orderSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid order payload', parsed.error.issues);
    const { bookId, tier } = parsed.data;
    const db = serviceClient();

    const { data: book } = await db
      .from('books')
      .select('id, parent_id, deleted_at')
      .eq('id', bookId)
      .maybeSingle();
    if (!book || (book as { deleted_at: string | null }).deleted_at) throw notFound('Book not found');
    if ((book as { parent_id: string }).parent_id !== parent.id) throw forbidden();

    // NEVER trust a client amount — price server-side from the tier.
    const price = priceFor(tier);
    if (!price.enabled) throw badRequest('This tier is not available yet');
    // A printed book cannot be created without somewhere to ship it.
    if (price.physical && !parsed.data.shippingAddress) {
      throw badRequest('A shipping address is required for a printed book');
    }
    const isGift = parsed.data.isGift === true;
    const { data: order, error: orderErr } = await db
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
      .select('id')
      .single();
    if (orderErr || !order) throw internal('Could not create order', orderErr?.message);

    // Persist the ship-to for physical tiers (parent-owned, RLS-scoped).
    if (price.physical && parsed.data.shippingAddress) {
      const a = parsed.data.shippingAddress;
      const { error: addrErr } = await db.from('shipping_addresses').insert({
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
      });
      if (addrErr) throw internal('Could not save shipping address', addrErr.message);
    }

    const rzp = await createOrder({ amount: price.amount, currency: price.currency, receipt: order.id, notes: { orderId: order.id, bookId, tier } });
    await db.from('orders').update({ razorpay_order_id: rzp.id }).eq('id', order.id);

    return Response.json({
      razorpayOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      keyId: loadEnv().RAZORPAY_KEY_ID,
    } satisfies CreateOrderResponse);
  } catch (err) {
    return jsonError(err);
  }
}
