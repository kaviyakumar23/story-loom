import { audit } from '../lib/audit';
import { evaluateAlerts } from '../lib/metrics';
import { applyRefundForPayment } from '../lib/refunds';
import { serviceClient } from '../lib/supabase';
import { EVENTS, inngest } from './client';

/**
 * Reconciliation cron (§12 failure recovery). Closes the "paid but never
 * fulfilled" gap: if the webhook marked an order paid but the fulfillment
 * enqueue failed (or the job died before completing), the book is stuck at
 * `status='paid'`. Every 15 minutes we re-enqueue fulfillment for any paid book
 * that's been stuck longer than the grace window. Fulfillment is idempotent, so
 * re-enqueuing a book that's actually mid-run is harmless.
 *
 * A per-book LEASE stops us re-enqueuing the same stuck book on every 15-min
 * cron: once picked, a book is leased for LEASE_MINUTES and skipped until it
 * expires. So a genuinely failing book is retried at most once per lease window,
 * not four times an hour (per-book concurrency:1 is still the real double-run
 * guard; this just avoids pointless churn).
 *
 * `failed` books are intentionally NOT retried here — those are moderation
 * blocks awaiting human review (§10).
 */
const STUCK_AFTER_MINUTES = 15;
const LEASE_MINUTES = 30;

export const reconcilePaidBooks = inngest.createFunction(
  {
    id: 'reconcile-paid-books',
    name: 'Reconcile paid-but-unfulfilled books',
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => {
    const stuck = await step.run('find-stuck', async () => {
      const now = Date.now();
      const cutoff = new Date(now - STUCK_AFTER_MINUTES * 60_000).toISOString();
      const leaseCutoff = new Date(now - LEASE_MINUTES * 60_000).toISOString();
      const db = serviceClient();
      const { data } = await db
        .from('books')
        .select('id')
        .eq('status', 'paid')
        .lt('updated_at', cutoff)
        // Skip books leased by a recent reconcile run (null lease = never leased).
        .or(`reconcile_leased_at.is.null,reconcile_leased_at.lt.${leaseCutoff}`)
        .limit(100);
      const candidates = ((data ?? []) as { id: string }[]).map((b) => b.id);
      if (!candidates.length) return [];

      // Only re-enqueue books whose order is still paid. A refunded order leaves
      // the book at 'paid' for as long as it takes the refund to land, and this
      // cron would otherwise keep restarting generation for a book nobody is
      // paying for — spending image budget on an order that has been undone.
      const { data: liveOrders } = await db
        .from('orders')
        .select('book_id')
        .in('book_id', candidates)
        .eq('status', 'paid');
      const payable = new Set(((liveOrders ?? []) as { book_id: string }[]).map((o) => o.book_id));
      const ids = candidates.filter((id) => payable.has(id));

      // Lease every candidate, including the ones we skipped: a book with no
      // paid order will never become enqueueable, so re-checking it every cron
      // is pure churn.
      await db.from('books').update({ reconcile_leased_at: new Date(now).toISOString() }).in('id', candidates);
      return ids;
    });

    // Re-apply webhook events that arrived before the thing they referred to —
    // typically a refund whose capture had not landed yet. Dropping those meant
    // a refunded payment could still be printed.
    await step.run('replay-deferred', async () => replayDeferredEvents());

    // Evaluate operational alerts on the same cadence (§12).
    await step.run('evaluate-alerts', async () => evaluateAlerts());

    if (!stuck.length) return { reEnqueued: 0 };

    await step.run('re-enqueue', async () => {
      for (const bookId of stuck) {
        await inngest.send({ name: EVENTS.fulfillmentRequested, data: { bookId } });
        await audit({
          actor: 'system',
          action: 'fulfillment.reconciled',
          entity: 'books',
          entityId: bookId,
          metadata: { reason: 'paid_but_unfulfilled' },
        });
      }
    });

    return { reEnqueued: stuck.length };
  },
);

/**
 * Replay webhook events parked as 'deferred' — a refund that arrived before the
 * capture it refers to. Without this, the refund is lost and the later capture
 * happily marks the order paid and sends a refunded book to print.
 *
 * Replayed through the same code path as a live refund, so there is one
 * implementation of what a refund means rather than two that can drift.
 */
async function replayDeferredEvents(): Promise<number> {
  const db = serviceClient();
  const { data } = await db
    .from('webhook_events')
    .select('id, event_type, raw')
    .eq('status', 'deferred')
    .order('created_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []) as {
    id: string;
    event_type: string;
    raw: { payload?: { refund?: { entity?: { id?: string; payment_id?: string; amount?: number } } } };
  }[];
  let applied = 0;
  for (const row of rows) {
    const refund = row.raw?.payload?.refund?.entity;
    if (row.event_type !== 'refund.processed' || !refund?.id || !refund.payment_id) continue;
    try {
      const result = await applyRefundForPayment({
        razorpayPaymentId: refund.payment_id,
        refundId: refund.id,
        amount: refund.amount ?? null,
      });
      // Still unresolvable — leave it parked rather than marking it done and
      // losing a refund that has genuinely not been applied anywhere.
      if (!result.applied && result.reason === 'unknown_payment') continue;
      await db
        .from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', row.id);
      applied += 1;
    } catch (err) {
      await db
        .from('webhook_events')
        .update({ error: err instanceof Error ? err.message : String(err) })
        .eq('id', row.id);
    }
  }
  return applied;
}
