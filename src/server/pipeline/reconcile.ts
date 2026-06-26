import { audit } from '../lib/audit';
import { evaluateAlerts } from '../lib/metrics';
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
 * `failed` books are intentionally NOT retried here — those are moderation
 * blocks awaiting human review (§10).
 */
const STUCK_AFTER_MINUTES = 15;

export const reconcilePaidBooks = inngest.createFunction(
  {
    id: 'reconcile-paid-books',
    name: 'Reconcile paid-but-unfulfilled books',
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => {
    const stuck = await step.run('find-stuck', async () => {
      const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
      const { data } = await serviceClient()
        .from('books')
        .select('id')
        .eq('status', 'paid')
        .lt('updated_at', cutoff)
        .limit(100);
      return ((data ?? []) as { id: string }[]).map((b) => b.id);
    });

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
