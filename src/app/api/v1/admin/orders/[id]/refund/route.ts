import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, notFound } from '@/server/lib/errors';
import { refundPayment } from '@/server/lib/razorpay';
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

    const { data: payment } = await db.from('payments').select('razorpay_payment_id').eq('order_id', id).maybeSingle();
    if (!payment) throw badRequest('No captured payment found for this order');

    const refund = await refundPayment({
      paymentId: (payment as { razorpay_payment_id: string }).razorpay_payment_id,
      amount: (order as { amount: number }).amount,
      idempotencyKey: `refund-${id}`,
    });

    await db.from('orders').update({ status: 'refunded' }).eq('id', id);
    await audit({ actor: 'admin', action: 'order.refunded', entity: 'orders', entityId: id, metadata: { refundId: refund.id, amount: refund.amount } });
    return Response.json({ ok: true, status: 'refunded', refundId: refund.id });
  } catch (err) {
    return jsonError(err);
  }
}
