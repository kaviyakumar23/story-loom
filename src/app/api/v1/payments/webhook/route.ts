import { randomUUID } from 'node:crypto';
import { audit } from '@/server/lib/audit';
import { sendAdminAlert, sendOrderReceived } from '@/server/lib/email';
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
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; error_description?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
  };
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
    if (event.event === 'payment.failed') return handlePaymentFailed(event);
    if (event.event === 'refund.processed') return handleRefundProcessed(event);
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
      // Real money moved but doesn't match the order — a human must look.
      try {
        await sendAdminAlert('Payment amount mismatch — manual review needed', {
          orderId: order.id,
          expected: order.amount,
          received: payment.amount,
          razorpayPaymentId: payment.id,
        });
      } catch {
        /* best-effort */
      }
      return Response.json({ ok: true, amountMismatch: true });
    }

    // Webhook is the source of truth — unlock and enqueue fulfillment.
    const paidAt = new Date().toISOString();
    await db.from('orders').update({ status: 'paid' }).eq('id', order.id);
    await db
      .from('books')
      .update({ purchased_tier: order.tier as Tier, status: 'paid', paid_at: paidAt })
      .eq('id', order.book_id);
    await audit({ actor: 'system', action: 'payment.captured', entity: 'orders', entityId: order.id, metadata: { razorpayPaymentId: payment.id, bookId: order.book_id } });
    await inngest.send({ name: EVENTS.fulfillmentRequested, data: { bookId: order.book_id, correlationId: randomUUID() } });

    const { data: user } = await db.auth.admin.getUserById(order.parent_id);
    if (user.user?.email) {
      try {
        await sendOrderReceived(user.user.email, order.tier, {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        });
      } catch {
        /* best-effort */
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * A payment attempt failed (UPI drop, declined card…). Record it for support
 * visibility, but leave the order alone — Razorpay allows retrying the same
 * order, and a later attempt may still be captured.
 */
async function handlePaymentFailed(event: RazorpayWebhook): Promise<Response> {
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) throw badRequest('Malformed webhook payload');
  const db = serviceClient();

  const { data: order } = await db
    .from('orders')
    .select('id')
    .eq('razorpay_order_id', payment.order_id)
    .maybeSingle();
  if (!order) return Response.json({ ok: true, unknownOrder: true });

  const { error: payErr } = await db.from('payments').insert({
    order_id: order.id,
    razorpay_payment_id: payment.id,
    signature_valid: true,
    status: 'failed',
    raw_webhook: event,
  });
  if (payErr) {
    if (payErr.code === '23505' || /duplicate key/i.test(payErr.message ?? '')) {
      return Response.json({ ok: true, deduped: true });
    }
    throw badRequest('Could not record failed payment', payErr.message);
  }
  await audit({ actor: 'system', action: 'payment.failed', entity: 'orders', entityId: order.id, metadata: { razorpayPaymentId: payment.id, reason: payment.error_description ?? null } });
  return Response.json({ ok: true });
}

/**
 * A refund completed (issued via our admin route or the Razorpay dashboard).
 * Sync order + payment status so the dashboard is never the only place that
 * knows. Mirrors the admin refund route: access to an already-delivered book
 * is not revoked.
 */
async function handleRefundProcessed(event: RazorpayWebhook): Promise<Response> {
  const refund = event.payload?.refund?.entity;
  if (!refund?.id || !refund.payment_id) throw badRequest('Malformed webhook payload');
  const db = serviceClient();

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status')
    .eq('razorpay_payment_id', refund.payment_id)
    .maybeSingle();
  if (!payment) return Response.json({ ok: true, unknownPayment: true });
  if ((payment as { status: string }).status === 'refunded') {
    return Response.json({ ok: true, deduped: true });
  }

  const orderId = (payment as { order_id: string }).order_id;
  await db.from('payments').update({ status: 'refunded' }).eq('id', (payment as { id: string }).id);
  await db.from('orders').update({ status: 'refunded' }).eq('id', orderId);
  await audit({ actor: 'system', action: 'order.refund_processed', entity: 'orders', entityId: orderId, metadata: { refundId: refund.id, razorpayPaymentId: refund.payment_id, amount: refund.amount ?? null } });
  return Response.json({ ok: true });
}
