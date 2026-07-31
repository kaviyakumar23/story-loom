import { randomUUID } from 'node:crypto';
import { audit } from '@/server/lib/audit';
import { sendAdminAlert, sendOrderReceived } from '@/server/lib/email';
import { badRequest, internal, notFound } from '@/server/lib/errors';
import { recordFunnel } from '@/server/lib/funnel';
import { verifyWebhookSignature } from '@/server/lib/razorpay';
import { applyRefundForPayment } from '@/server/lib/refunds';
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

    // Journal the delivery before acting on it. Deduplication used to rest
    // entirely on the payment id, which only catches repeats of the same
    // payment — a redelivered event of any other type was reprocessed, and
    // nothing recorded that an event had ever arrived. Razorpay's own event id
    // is the right key, and it was never read.
    const eventId = req.headers.get('x-razorpay-event-id');
    if (eventId && (await alreadySeen(eventId, event))) {
      return Response.json({ ok: true, deduped: true });
    }

    if (event.event === 'payment.failed') return handlePaymentFailed(event);
    if (event.event === 'refund.processed') return handleRefundProcessed(event, eventId);
    if (event.event !== 'payment.captured') return Response.json({ ok: true });

    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id) throw badRequest('Malformed webhook payload');
    const db = serviceClient();

    const { data: order } = await db
      .from('orders')
      .select('id, parent_id, book_id, tier, amount, currency, status, price_arm')
      .eq('razorpay_order_id', payment.order_id)
      .maybeSingle();
    if (!order) {
      // Real money we cannot tie to an order. This used to return 404, which
      // made Razorpay retry into the void: no alert, no audit row, and not even
      // a Sentry capture, so a captured payment could go unnoticed indefinitely.
      // Record it, tell a human, and stop the retries.
      await recordUnmatched(eventId, event, payment.id, payment.order_id);
      try {
        await sendAdminAlert('Captured payment with no matching order — manual review needed', {
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          amount: payment.amount ?? null,
          currency: payment.currency ?? null,
        });
      } catch {
        /* best-effort */
      }
      return Response.json({ ok: true, unmatchedOrder: true });
    }

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
      razorpay_event_id: eventId,
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

    // Activate once (webhook is the source of truth). This is a CONDITIONAL
    // update rather than a read-then-write: two deliveries arriving together
    // both saw status 'created' under the old check and both went on to stamp
    // the series number and send a receipt. Whoever moves the row wins; the
    // other sees zero rows and skips straight to the fulfilment self-heal.
    const paidAt = new Date().toISOString();
    const { data: activated } = await db
      .from('orders')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('id', order.id)
      .eq('status', 'created')
      .select('id');

    if (activated?.length) {
      // Stamp the series position (1 + the hero's already-purchased books) — for
      // the bookshelf and the printed spine. Computed before this book is marked
      // paid, so the count is of PRIOR purchases only.
      const seriesNumber = await nextSeriesNumber(db, order.book_id);
      await db
        .from('books')
        .update({ purchased_tier: order.tier as Tier, status: 'paid', paid_at: paidAt, render_credits: POST_PAY_REGEN_CREDITS, series_number: seriesNumber })
        .eq('id', order.book_id);
      await audit({ actor: 'system', action: 'payment.captured', entity: 'orders', entityId: order.id, metadata: { razorpayPaymentId: payment.id, bookId: order.book_id } });
      // The end of the funnel, written server-side: a purchase counted from the
      // client would count intentions, and the webhook is the only thing that
      // knows money actually moved.
      await recordFunnel('purchase', {
        orderId: order.id,
        bookId: order.book_id,
        arm: (order as { price_arm?: 'A' | 'B' }).price_arm ?? null,
        props: { amount: order.amount },
      });

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
 * The next series position for this book's hero: 1 + the count of the hero's
 * already-purchased books. Best-effort — a stamping failure must not block the
 * payment, so it defaults to 1 if the hero can't be resolved.
 */
async function nextSeriesNumber(db: ReturnType<typeof serviceClient>, bookId: string): Promise<number> {
  const { data: book } = await db.from('books').select('hero_id').eq('id', bookId).maybeSingle();
  const heroId = (book as { hero_id: string } | null)?.hero_id;
  if (!heroId) return 1;
  const { count } = await db
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId)
    .not('purchased_tier', 'is', null);
  return (count ?? 0) + 1;
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
 * The work itself lives in server/lib/refunds so the reconcile cron can replay
 * a deferred refund through exactly the same path.
 */
export async function handleRefundProcessed(event: RazorpayWebhook, eventId?: string | null): Promise<Response> {
  const refund = event.payload?.refund?.entity;
  if (!refund?.id || !refund.payment_id) throw badRequest('Malformed webhook payload');

  const result = await applyRefundForPayment({
    razorpayPaymentId: refund.payment_id,
    refundId: refund.id,
    amount: refund.amount ?? null,
  });

  if (!result.applied) {
    if (result.reason === 'already_refunded') return Response.json({ ok: true, deduped: true });
    // Out of order: the refund arrived before the capture it refers to. Dropping
    // it here meant a later capture would mark the order paid and start printing
    // a refunded book. Hold it for the reconcile cron to replay.
    await deferEvent(eventId, event, refund.payment_id);
    return Response.json({ ok: true, deferred: true });
  }

  return Response.json({ ok: true, alreadyReleased: result.outcome.alreadyReleased });
}

/**
 * Record the delivery. Returns true when this exact event has been seen before,
 * in which case the caller must not act on it again.
 */
async function alreadySeen(eventId: string, event: RazorpayWebhook): Promise<boolean> {
  const { error } = await serviceClient().from('webhook_events').insert({
    razorpay_event_id: eventId,
    event_type: event.event,
    razorpay_payment_id: event.payload?.payment?.entity?.id ?? event.payload?.refund?.entity?.payment_id ?? null,
    razorpay_order_id: event.payload?.payment?.entity?.order_id ?? null,
    status: 'processed',
    raw: event,
    processed_at: new Date().toISOString(),
  });
  if (!error) return false;
  if (error.code === '23505' || /duplicate key/i.test(error.message ?? '')) return true;
  // A journal failure must not drop a real payment on the floor — process it and
  // let the payment-id uniqueness remain the backstop it has always been.
  console.error('[webhook] could not journal event', eventId, error.message);
  return false;
}

/** Park an event that arrived before the thing it refers to, for later replay. */
async function deferEvent(eventId: string | null | undefined, event: RazorpayWebhook, paymentId: string): Promise<void> {
  const db = serviceClient();
  const row = {
    event_type: event.event,
    razorpay_payment_id: paymentId,
    status: 'deferred',
    raw: event,
    processed_at: null,
  };
  if (eventId) {
    // The journal row already exists from alreadySeen(); move it to deferred.
    await db.from('webhook_events').update(row).eq('razorpay_event_id', eventId);
  } else {
    await db.from('webhook_events').insert({ ...row, razorpay_event_id: null });
  }
}

/** Money we cannot attribute. Kept, alerted on, and never silently retried. */
async function recordUnmatched(
  eventId: string | null | undefined,
  event: RazorpayWebhook,
  paymentId: string,
  orderId: string,
): Promise<void> {
  const db = serviceClient();
  const row = {
    event_type: event.event,
    razorpay_payment_id: paymentId,
    razorpay_order_id: orderId,
    status: 'unmatched',
    raw: event,
  };
  if (eventId) await db.from('webhook_events').update(row).eq('razorpay_event_id', eventId);
  else await db.from('webhook_events').insert({ ...row, razorpay_event_id: null });
  await audit({
    actor: 'system',
    action: 'payment.unmatched',
    entity: 'orders',
    entityId: orderId,
    metadata: { razorpayPaymentId: paymentId },
  });
}
