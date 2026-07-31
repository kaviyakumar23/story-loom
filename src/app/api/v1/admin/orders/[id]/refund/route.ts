import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, notFound } from '@/server/lib/errors';
import { refundPayment } from '@/server/lib/razorpay';
import { applyRefundForPayment } from '@/server/lib/refunds';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- POST /api/v1/admin/orders/:id/refund ----
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid id');
    const db = serviceClient();

    const { data: order } = await db.from('orders').select('id, status, amount').eq('id', id).maybeSingle();
    if (!order) throw notFound('Order not found');
    const status = (order as { status: string }).status;
    if (status === 'refunded') return Response.json({ ok: true, status: 'refunded', alreadyRefunded: true });
    if (status !== 'paid') throw badRequest('Only paid orders can be refunded');

    // An order can hold more than one payment row: a declined first attempt
    // followed by a successful one. maybeSingle() errors on two rows and
    // discarded the error, so refunding any customer whose card failed once was
    // impossible — and without the status filter it could have picked the
    // failed attempt to refund.
    const { data: payment } = await db
      .from('payments')
      .select('razorpay_payment_id')
      .eq('order_id', id)
      .eq('status', 'captured')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment) throw badRequest('No captured payment found for this order');
    const razorpayPaymentId = (payment as { razorpay_payment_id: string }).razorpay_payment_id;

    const refund = await refundPayment({
      paymentId: razorpayPaymentId,
      amount: (order as { amount: number }).amount,
      idempotencyKey: `refund-${id}`,
    });

    // Stop the book in the same transaction that marks the order refunded —
    // cancelling any fulfilment that has not gone to print, and telling us if it
    // already has.
    const result = await applyRefundForPayment({
      razorpayPaymentId,
      refundId: refund.id,
      amount: refund.amount,
    });
    await audit({ actor: 'admin', action: 'order.refunded', entity: 'orders', entityId: id, metadata: { refundId: refund.id, amount: refund.amount } });
    return Response.json({
      ok: true,
      status: 'refunded',
      refundId: refund.id,
      alreadyReleased: result.applied ? result.outcome.alreadyReleased : false,
    });
  } catch (err) {
    return jsonError(err);
  }
}
