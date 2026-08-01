import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { sendAdminAlert } from '../lib/email';
import { captureError } from '../lib/observability';
import { fetchPayments } from '../lib/razorpay';
import { serviceClient } from '../lib/supabase';
import { inngest } from './client';

/**
 * Daily reconciliation against Razorpay.
 *
 * Every other recovery path in this system starts from a webhook. That is fine
 * until one is never delivered: our order stays at 'created', Razorpay shows it
 * captured, the customer has paid and has no book — and nothing looks. The
 * existing reconcile cron only ever asked "is a PAID book stuck?", which cannot
 * see an order that never became paid in the first place.
 *
 * So once a day we ask Razorpay what it thinks happened and compare. Anything
 * that does not line up is recorded and emailed rather than fixed automatically:
 * money that does not match our records is precisely the situation where a
 * confident automatic correction is the wrong instinct.
 */
const WINDOW_HOURS = 48;

export const reconcilePayments = inngest.createFunction(
  {
    id: 'reconcile-payments',
    name: 'Reconcile payments against Razorpay',
    triggers: [{ cron: '40 2 * * *' }],
  },
  async ({ step }) => {
    const env = loadEnv();
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return { skipped: 'razorpay_not_configured' as const };
    }

    const discrepancies = await step.run('compare', async () => compareWindow());

    if (discrepancies.length) {
      await step.run('alert', async () => {
        try {
          await sendAdminAlert(`Payment reconciliation found ${discrepancies.length} discrepancy(ies)`, {
            window: `${WINDOW_HOURS}h`,
            items: discrepancies.slice(0, 20),
          });
        } catch (err) {
          captureError(err, { stage: 'payments-reconcile' });
        }
      });
    }

    return { checked: discrepancies.length, discrepancies };
  },
);

interface Discrepancy {
  kind: 'captured_but_not_paid' | 'captured_with_no_order' | 'amount_mismatch';
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  detail: string;
}

async function compareWindow(): Promise<Discrepancy[]> {
  const now = Math.floor(Date.now() / 1000);
  const captured = (await fetchPayments({ fromSeconds: now - WINDOW_HOURS * 3600, toSeconds: now })).filter(
    (p) => p.status === 'captured',
  );
  if (!captured.length) return [];

  const db = serviceClient();
  const orderIds = captured.map((p) => p.orderId).filter((id): id is string => Boolean(id));
  const { data: ours } = await db
    .from('orders')
    .select('id, razorpay_order_id, status, amount, currency')
    .in('razorpay_order_id', orderIds.length ? orderIds : ['__none__']);
  const byRazorpayId = new Map(
    ((ours ?? []) as { id: string; razorpay_order_id: string; status: string; amount: number; currency: string }[]).map(
      (o) => [o.razorpay_order_id, o],
    ),
  );

  const out: Discrepancy[] = [];
  for (const payment of captured) {
    const order = payment.orderId ? byRazorpayId.get(payment.orderId) : undefined;

    if (!order) {
      out.push({
        kind: 'captured_with_no_order',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.orderId,
        detail: `Razorpay captured ${payment.amount} ${payment.currency} against an order we have no record of`,
      });
      continue;
    }
    if (order.amount !== payment.amount || order.currency !== payment.currency) {
      out.push({
        kind: 'amount_mismatch',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.orderId,
        detail: `expected ${order.amount} ${order.currency}, Razorpay captured ${payment.amount} ${payment.currency}`,
      });
      continue;
    }
    if (order.status === 'created') {
      // The webhook never landed. The customer has paid and, as far as our
      // system is concerned, has not.
      out.push({
        kind: 'captured_but_not_paid',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.orderId,
        detail: `order ${order.id} is still 'created' but Razorpay shows it captured`,
      });
    }
  }

  for (const d of out) {
    await recordDiscrepancy(d);
  }
  return out;
}

/**
 * Park the discrepancy in the webhook journal so it survives this run, and audit
 * it. Deliberately not self-healing: a mismatch between our records and a
 * payment processor's is where an automatic correction does the most damage.
 */
async function recordDiscrepancy(d: Discrepancy): Promise<void> {
  const db = serviceClient();
  const { data: existing } = await db
    .from('webhook_events')
    .select('id')
    .eq('razorpay_payment_id', d.razorpayPaymentId)
    .eq('status', 'unmatched')
    .maybeSingle();
  if (existing) return;

  await db.from('webhook_events').insert({
    razorpay_event_id: null,
    event_type: `reconcile.${d.kind}`,
    razorpay_payment_id: d.razorpayPaymentId,
    razorpay_order_id: d.razorpayOrderId,
    status: 'unmatched',
    raw: d,
    error: d.detail,
  });
  await audit({
    actor: 'system',
    action: 'payment.reconcile_discrepancy',
    entity: 'orders',
    entityId: d.razorpayOrderId ?? d.razorpayPaymentId,
    metadata: { kind: d.kind, detail: d.detail },
  });
}
