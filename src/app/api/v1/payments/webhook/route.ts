import { randomUUID } from 'node:crypto';
import { audit } from '@/server/lib/audit';
import { sendOrderReceived } from '@/server/lib/email';
import { badRequest, notFound } from '@/server/lib/errors';
import { verifyWebhookSignature } from '@/server/lib/razorpay';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';
import type { Tier } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RazorpayWebhook {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number } } };
}

// ---- POST /api/v1/payments/webhook — Razorpay → us. No user auth; verify HMAC. ----
export async function POST(req: Request): Promise<Response> {
  try {
    // Raw body is required to verify the HMAC over the exact bytes (§8).
    const raw = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature || !verifyWebhookSignature(raw, signature)) {
      throw badRequest('Invalid webhook signature');
    }

    const event = JSON.parse(raw) as RazorpayWebhook;
    if (event.event !== 'payment.captured') return Response.json({ ok: true });

    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id) throw badRequest('Malformed webhook payload');
    const db = serviceClient();

    const { data: order } = await db
      .from('orders')
      .select('id, parent_id, book_id, tier, amount, currency, status')
      .eq('razorpay_order_id', payment.order_id)
      .maybeSingle();
    if (!order) throw notFound('Order not found for webhook');

    const amountOk = typeof payment.amount === 'number' && payment.amount === order.amount;

    // Idempotency (§8): unique razorpay_payment_id — redelivery no-ops.
    const { error: payErr } = await db.from('payments').insert({
      order_id: order.id,
      razorpay_payment_id: payment.id,
      signature_valid: true,
      status: amountOk ? (payment.status ?? 'captured') : 'amount_mismatch',
      raw_webhook: event,
    });
    if (payErr) {
      if (payErr.code === '23505' || /duplicate key/i.test(payErr.message ?? '')) {
        return Response.json({ ok: true, deduped: true });
      }
      throw badRequest('Could not record payment', payErr.message);
    }

    if (!amountOk) {
      await audit({ actor: 'system', action: 'payment.amount_mismatch', entity: 'orders', entityId: order.id, metadata: { expected: order.amount, received: payment.amount, paymentId: payment.id } });
      return Response.json({ ok: true, amountMismatch: true });
    }

    // Webhook is the source of truth — unlock and enqueue fulfillment.
    await db.from('orders').update({ status: 'paid' }).eq('id', order.id);
    await db.from('books').update({ purchased_tier: order.tier as Tier, status: 'paid' }).eq('id', order.book_id);
    await audit({ actor: 'system', action: 'payment.captured', entity: 'orders', entityId: order.id, metadata: { razorpayPaymentId: payment.id, bookId: order.book_id } });
    await inngest.send({ name: EVENTS.fulfillmentRequested, data: { bookId: order.book_id, correlationId: randomUUID() } });

    const { data: user } = await db.auth.admin.getUserById(order.parent_id);
    if (user.user?.email) {
      try {
        await sendOrderReceived(user.user.email, order.tier);
      } catch {
        /* best-effort */
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
