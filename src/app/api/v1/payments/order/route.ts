import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { priceFor } from '@/server/config/pricing';
import { requireParent } from '@/server/auth';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { createOrder } from '@/server/lib/razorpay';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { TIERS, type CreateOrderResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const orderSchema = z.object({ bookId: z.string().uuid(), tier: z.enum(TIERS) });

// ---- POST /api/v1/payments/order — server-priced Razorpay order (§8) ----
export async function POST(req: Request): Promise<Response> {
  try {
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
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({ parent_id: parent.id, book_id: bookId, tier, amount: price.amount, currency: price.currency, status: 'created' })
      .select('id')
      .single();
    if (orderErr || !order) throw badRequest('Could not create order', orderErr?.message);

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
