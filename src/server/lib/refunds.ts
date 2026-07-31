import { audit } from './audit';
import { sendAdminAlert, sendRefundConfirmation } from './email';
import { internal } from './errors';
import { serviceClient } from './supabase';

/**
 * Applying a refund.
 *
 * A refund has to stop the book, not just relabel the order. This used to change
 * two status columns that nothing read: generation kept running, the print queue
 * kept advancing, and the reconcile cron re-enqueued the book because
 * `books.status` was still 'paid'. The whole thing is one database transaction
 * now, because a refund landing between a check and a state change is exactly
 * how a refunded book gets printed.
 *
 * Lives here rather than in the webhook route because two callers need it: the
 * webhook, and the cron that replays refunds which arrived before their capture.
 */
export interface RefundOutcome {
  /** The file had already gone to the printer — software cannot recall it. */
  alreadyReleased: boolean;
  fulfillmentCancelled: boolean;
}

export type RefundResult =
  | { applied: true; outcome: RefundOutcome }
  /** The payment is not one we know about — usually a refund that overtook its capture. */
  | { applied: false; reason: 'unknown_payment' }
  | { applied: false; reason: 'already_refunded' };

export async function applyRefundForPayment(input: {
  razorpayPaymentId: string;
  refundId: string;
  amount?: number | null;
}): Promise<RefundResult> {
  const db = serviceClient();

  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, status')
    .eq('razorpay_payment_id', input.razorpayPaymentId)
    .maybeSingle();
  const row = payment as { id: string; order_id: string; status: string } | null;
  if (!row) return { applied: false, reason: 'unknown_payment' };
  if (row.status === 'refunded') return { applied: false, reason: 'already_refunded' };

  const { data: result, error } = await db.rpc('apply_refund', { p_order: row.order_id });
  if (error) throw internal('Could not apply the refund', error.message);
  const raw = (Array.isArray(result) ? result[0] : result) as
    | { already_released?: boolean; fulfillment_cancelled?: boolean }
    | null;
  const outcome: RefundOutcome = {
    alreadyReleased: raw?.already_released === true,
    fulfillmentCancelled: raw?.fulfillment_cancelled === true,
  };

  await db.from('payments').update({ status: 'refunded' }).eq('id', row.id);
  await audit({
    actor: 'system',
    action: 'order.refund_processed',
    entity: 'orders',
    entityId: row.order_id,
    metadata: {
      refundId: input.refundId,
      razorpayPaymentId: input.razorpayPaymentId,
      amount: input.amount ?? null,
      alreadyReleased: outcome.alreadyReleased,
    },
  });

  // Tell the customer. Until now nothing did, so the only way to learn a refund
  // had happened was to notice it on a bank statement — which is how a refund
  // becomes a support ticket.
  try {
    const { data: order } = await db
      .from('orders')
      .select('id, parent_id, amount, currency')
      .eq('id', row.order_id)
      .maybeSingle();
    const o = order as { id: string; parent_id: string | null; amount: number; currency: string } | null;
    if (o?.parent_id) {
      const { data: user } = await db.auth.admin.getUserById(o.parent_id);
      if (user.user?.email) {
        await sendRefundConfirmation(user.user.email, {
          orderId: o.id,
          amount: o.amount,
          currency: o.currency,
        });
      }
    }
  } catch {
    /* best-effort — the refund itself has already gone through */
  }

  if (outcome.alreadyReleased) {
    // The file is at the printer. Nothing here can pull it back, so the only
    // useful thing software can do is make sure a person knows quickly.
    try {
      await sendAdminAlert('Refund on a book already released to print — decide reprint or stop', {
        orderId: row.order_id,
        razorpayPaymentId: input.razorpayPaymentId,
        amount: input.amount ?? null,
      });
    } catch {
      /* best-effort */
    }
  }

  return { applied: true, outcome };
}
