import { alert } from './observability';
import { serviceClient } from './supabase';

/**
 * Operational metrics + alerts (§12). Computes the key signals from
 * generation_events / books / payments over a recent window and raises threshold
 * alerts: cost-per-book, average attempts-per-image (the §6 retry-inflation
 * alarm), webhook-failure rate, and moderation-queue depth.
 */

// Alert thresholds — aligned to the validated COGS ranges (§15).
const COST_PER_BOOK_ALERT_USD = 3.5;
const ATTEMPTS_PER_IMAGE_ALERT = 1.5;
const MODERATION_QUEUE_ALERT = 25;

export interface Metrics {
  windowDays: number;
  booksCompleted: number;
  avgCostPerBookUsd: number;
  avgAttemptsPerImage: number;
  moderationQueueDepth: number;
  webhookAmountMismatches: number;
  paymentsTotal: number;
}

export async function computeMetrics(windowDays = 7): Promise<Metrics> {
  const db = serviceClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [{ data: events }, { count: failedCount }, { data: payments }] = await Promise.all([
    db
      .from('generation_events')
      .select('book_id, stage, images, cost_usd, status')
      .gte('finished_at', since)
      .limit(5000),
    db.from('books').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    db.from('payments').select('status').gte('captured_at', since).limit(5000),
  ]);

  const rows = (events ?? []) as {
    book_id: string;
    stage: string;
    images: number | null;
    cost_usd: number | null;
    status: string;
  }[];

  // Cost per book = avg of summed cost over distinct books seen in the window.
  const costByBook = new Map<string, number>();
  for (const r of rows) {
    costByBook.set(r.book_id, (costByBook.get(r.book_id) ?? 0) + Number(r.cost_usd ?? 0));
  }
  const costs = [...costByBook.values()];
  const avgCostPerBookUsd = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  // Attempts per image = image-stage calls / images actually produced.
  const imageRows = rows.filter((r) => r.stage === 'images');
  const imageCalls = imageRows.length;
  const imagesProduced = imageRows.reduce((a, r) => a + (r.images ?? 0), 0);
  const avgAttemptsPerImage = imagesProduced ? imageCalls / imagesProduced : 0;

  const pays = (payments ?? []) as { status: string }[];
  const mismatches = pays.filter((p) => p.status === 'amount_mismatch').length;

  return {
    windowDays,
    booksCompleted: costByBook.size,
    avgCostPerBookUsd: round(avgCostPerBookUsd),
    avgAttemptsPerImage: round(avgAttemptsPerImage),
    moderationQueueDepth: failedCount ?? 0,
    webhookAmountMismatches: mismatches,
    paymentsTotal: pays.length,
  };
}

/** Evaluate thresholds and raise alerts. Returns the breached metric names. */
export async function evaluateAlerts(): Promise<string[]> {
  const m = await computeMetrics();
  const breaches: string[] = [];

  if (m.avgCostPerBookUsd > COST_PER_BOOK_ALERT_USD) {
    breaches.push('cost_per_book');
    alert('Cost per book above target', { value: m.avgCostPerBookUsd, threshold: COST_PER_BOOK_ALERT_USD });
  }
  if (m.avgAttemptsPerImage > ATTEMPTS_PER_IMAGE_ALERT) {
    breaches.push('attempts_per_image');
    alert('Retry inflation: attempts/image high', { value: m.avgAttemptsPerImage, threshold: ATTEMPTS_PER_IMAGE_ALERT });
  }
  if (m.moderationQueueDepth > MODERATION_QUEUE_ALERT) {
    breaches.push('moderation_queue');
    alert('Moderation review queue backing up', { depth: m.moderationQueueDepth, threshold: MODERATION_QUEUE_ALERT });
  }
  if (m.webhookAmountMismatches > 0) {
    breaches.push('webhook_amount_mismatch');
    alert('Webhook amount mismatches detected', { count: m.webhookAmountMismatches });
  }
  return breaches;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
