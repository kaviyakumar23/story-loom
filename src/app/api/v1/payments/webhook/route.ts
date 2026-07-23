import { randomUUID } from 'node:crypto';
import { audit } from '@/server/lib/audit';
import { sendAdminAlert, sendOrderReceived } from '@/server/lib/email';
import { badRequest, internal, notFound } from '@/server/lib/errors';
import { verifyWebhookSignature } from '@/server/lib/razorpay';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';
import type { Tier } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Small allowance of per-page illustration regenerations, granted once on
// payment. Text edits are free; only re-rendering an image debits this.
const POST_PAY_REGEN_CREDITS = 3;

interface RazorpayWebhook {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string; error_description?: string } };
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

    // Verify the money matches the order we priced (§8) — amount AND currency.
    const amountOk =
      typeof payment.amount === 'number' &&
      payment.amount === order.amount &&
      (payment.currency == null || payment.currency === order.currency);

    // Idempotency (§8): unique razorpay_payment_id. On redelivery, self-heal a
    // paid-but-unfulfilled order (a prior emit may have been lost) — don't no-op.
    const { error: payErr } = await db.from('payments').insert({
      order_id: order.id,
      razorpay_payment_id: payment.id,
      signature_valid: true,
      status: amountOk ? (payment.status ?? 'captured') : 'amount_mismatch',
      raw_webhook: event,
    });
    if (payErr) {
      if (payErr.code === '23505' || /duplicate key/i.test(payErr.message ?? '')) {
        if (order.status === 'paid') await ensureFulfillment(db, order.book_id);
        return Response.json({ ok: true, deduped: true });
      }
      throw internal('Could not record payment', payErr.message);
    }

    if (!amountOk) {
      await audit({ actor: 'system', action: 'payment.amount_mismatch', entity: 'orders', entityId: order.id, metadata: { expected: order.amount, expectedCurrency: order.currency, received: payment.amount, receivedCurrency: payment.currency ?? null, paymentId: payment.id } });
      // Real money moved but doesn't match the order — a human must look.
      try {
        await sendAdminAlert('Payment amount/currency mismatch — manual review needed', {
          orderId: order.id,
          expected: order.amount,
          received: payment.amount,
          expectedCurrency: order.currency,
          receivedCurrency: payment.currency ?? null,
          razorpayPaymentId: payment.id,
        });
      } catch {
        /* best-effort */
      }
      return Response.json({ ok: true, amountMismatch: true });
    }

    // Activate once (webhook is the source of truth). Guard on status so a second
    // distinct payment for an already-paid order can't re-mark or double-email it.
    if (order.status !== 'paid') {
      const paidAt = new Date().toISOString();
      await db.from('orders').update({ status: 'paid' }).eq('id', order.id);
      await db
        .from('books')
        .update({ purchased_tier: order.tier as Tier, status: 'paid', paid_at: paidAt, render_credits: POST_PAY_REGEN_CREDITS })
        .eq('id', order.book_id);
      await audit({ actor: 'system', action: 'payment.captured', entity: 'orders', entityId: order.id, metadata: { razorpayPaymentId: payment.id, bookId: order.book_id } });

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
    }

    // Always (idempotently) ensure fulfilment is running for a paid order whose
    // book isn't finished — this self-heals a lost emit without a separate outbox.
    await ensureFulfillment(db, order.book_id);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Idempotently (re)enqueue fulfilment for a paid order whose book isn't complete.
 * The fulfilment pipeline's per-book concurrency:1 + "already complete" guard make
 * re-emitting safe, so this is also the recovery path for a webhook whose earlier
 * Inngest emit was lost — closing the payment→fulfilment atomicity gap without a
 * transactional outbox (the reconcile cron stays the final backstop).
 */
async function ensureFulfillment(db: ReturnType<typeof serviceClient>, bookId: string): Promise<void> {
  const { data: book } = await db.from('books').select('status').eq('id', bookId).maybeSingle();
  const status = (book as { status: string } | null)?.status;
  if (status && status !== 'complete') {
    await inngest.send({ name: EVENTS.fulfillmentRequested, data: { bookId, correlationId: randomUUID() } });
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
    throw internal('Could not record failed payment', payErr.message);
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
