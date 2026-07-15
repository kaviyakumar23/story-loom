import { alert } from './observability';
import { serviceClient } from './supabase';

/**
 * Operational metrics + alerts (§12). Computes the key signals from
 * generation_events / books / payments over a recent window and raises threshold
 * alerts: cost-per-book, average attempts-per-image (the §6 retry-inflation
 * alarm), webhook-failure rate, and moderation-queue depth.
 */

// Alert thresholds — aligned to the validated COGS ranges (§15).
//
// Cost is averaged over every book generated in the window, previews included
// (a preview is 4 images, a full book ~16). At the cost image tier that's ~$0.16
// and ~$0.62; $1.00 sits above both and below the ~$2.15 a full book costs on
// the pro image model — so this fires if someone flips IMAGE_MODEL_TIER, or if
// retries inflate. It must stay well under the ₹299 (~$3.40) sale price: the old
// $3.50 was above it, so a book could never cost "too much" to trip the alarm.
const COST_PER_BOOK_ALERT_USD = 1.0;
const ATTEMPTS_PER_IMAGE_ALERT = 1.5;
const MODERATION_QUEUE_ALERT = 25;

export interface Metrics {
  windowDays: number;
  booksStarted: number;
  previewsReady: number;
  previewSuccessRate: number;
  failedBooks: number;
  paidBooks: number;
  completedBooks: number;
  avgMinutesToPreview: number;
  avgMinutesFromPaidToComplete: number;
  previewViews: number;
  previewedBooks: number;
  previewPageChanges: number;
  alphaPreviewSaves: number;
  previewSharesCreated: number;
  previewSharesCopied: number;
  previewTweaksRequested: number;
  pdfDownloads: number;
  audioDownloads: number;
  feedbackCount: number;
  avgFeedbackRating: number;
  feedbackIssueCount: number;
  supportIssueCount: number;
  wantsFullBookCount: number;
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

  const [
    { data: events },
    { count: failedCount },
    { data: payments },
    { data: books },
    { data: productEvents },
    { data: feedback },
  ] = await Promise.all([
    db
      .from('generation_events')
      .select('book_id, stage, images, cost_usd, status')
      .gte('finished_at', since)
      .limit(5000),
    db.from('books').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    db.from('payments').select('status').gte('captured_at', since).limit(5000),
    db
      .from('books')
      .select('id, status, created_at, updated_at, preview_ready_at, paid_at, completed_at')
      .gte('created_at', since)
      .is('deleted_at', null)
      .limit(5000),
    db.from('book_events').select('book_id, event, created_at').gte('created_at', since).limit(10000),
    db
      .from('book_feedback')
      .select('book_id, rating, issue_type, wants_full_book, created_at')
      .gte('created_at', since)
      .limit(5000),
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

  const bookRows = (books ?? []) as BookMetricRow[];
  const productRows = (productEvents ?? []) as ProductEventRow[];
  const feedbackRows = (feedback ?? []) as FeedbackMetricRow[];

  const booksStarted = bookRows.length;
  const previewsReady = bookRows.filter(hasPreview).length;
  const failedBooks = bookRows.filter((b) => b.status === 'failed').length;
  const paidBooks = bookRows.filter((b) => Boolean(b.paid_at) || b.status === 'paid' || b.status === 'complete').length;
  const completedBooks = bookRows.filter((b) => Boolean(b.completed_at) || b.status === 'complete').length;

  const previewMinutes = bookRows
    .map((b) => minutesBetween(b.created_at, previewReachedAt(b)))
    .filter(isNumber);
  const fulfillmentMinutes = bookRows
    .map((b) => minutesBetween(b.paid_at, b.completed_at))
    .filter(isNumber);

  const previewViews = countEvents(productRows, 'preview_viewed');
  const previewedBooks = new Set(productRows.filter((e) => e.event === 'preview_viewed').map((e) => e.book_id)).size;
  const feedbackIssueCount = feedbackRows.filter((f) => f.issue_type !== 'none').length;

  return {
    windowDays,
    booksStarted,
    previewsReady,
    previewSuccessRate: booksStarted ? round(previewsReady / booksStarted) : 0,
    failedBooks,
    paidBooks,
    completedBooks,
    avgMinutesToPreview: round(avg(previewMinutes)),
    avgMinutesFromPaidToComplete: round(avg(fulfillmentMinutes)),
    previewViews,
    previewedBooks,
    previewPageChanges: countEvents(productRows, 'preview_page_changed'),
    alphaPreviewSaves: countEvents(productRows, 'alpha_preview_saved'),
    previewSharesCreated: countEvents(productRows, 'preview_share_created'),
    previewSharesCopied: countEvents(productRows, 'preview_share_copied'),
    previewTweaksRequested: countEvents(productRows, 'preview_tweak_requested'),
    pdfDownloads: countEvents(productRows, 'download_pdf_clicked'),
    audioDownloads: countEvents(productRows, 'download_audio_clicked'),
    feedbackCount: feedbackRows.length,
    avgFeedbackRating: round(avg(feedbackRows.map((f) => f.rating))),
    feedbackIssueCount,
    supportIssueCount: feedbackIssueCount,
    wantsFullBookCount: feedbackRows.filter((f) => f.wants_full_book).length,
    booksCompleted: costByBook.size,
    avgCostPerBookUsd: round(avgCostPerBookUsd),
    avgAttemptsPerImage: round(avgAttemptsPerImage),
    moderationQueueDepth: failedCount ?? 0,
    webhookAmountMismatches: mismatches,
    paymentsTotal: pays.length,
  };
}

export async function buildAlphaMetricsCsv(windowDays = 30): Promise<string> {
  const db = serviceClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const [{ data: books }, { data: events }, { data: feedback }] = await Promise.all([
    db
      .from('books')
      .select('id, parent_id, status, goal, occasion_pack, purchased_tier, created_at, updated_at, preview_ready_at, paid_at, completed_at')
      .gte('created_at', since)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10000),
    db.from('book_events').select('book_id, event, created_at').gte('created_at', since).limit(30000),
    db
      .from('book_feedback')
      .select('book_id, rating, issue_type, comments, wants_full_book, created_at')
      .gte('created_at', since)
      .limit(10000),
  ]);

  const eventRows = (events ?? []) as ProductEventRow[];
  const feedbackRows = (feedback ?? []) as FeedbackExportRow[];
  const eventsByBook = new Map<string, ProductEventRow[]>();
  const feedbackByBook = new Map<string, FeedbackExportRow[]>();

  for (const event of eventRows) {
    const list = eventsByBook.get(event.book_id) ?? [];
    list.push(event);
    eventsByBook.set(event.book_id, list);
  }

  for (const item of feedbackRows) {
    const list = feedbackByBook.get(item.book_id) ?? [];
    list.push(item);
    feedbackByBook.set(item.book_id, list);
  }

  const headers = [
    'bookId',
    'parentId',
    'status',
    'goal',
    'occasionPack',
    'purchasedTier',
    'createdAt',
    'previewReadyAt',
    'paidAt',
    'completedAt',
    'minutesToPreview',
    'minutesPaidToComplete',
    'previewViews',
    'previewPageChanges',
    'alphaPreviewSaves',
    'previewSharesCreated',
    'previewSharesCopied',
    'previewTweaksRequested',
    'pdfDownloads',
    'audioDownloads',
    'latestFeedbackRating',
    'latestFeedbackIssue',
    'wantsFullBook',
    'latestFeedbackAt',
    'latestFeedbackComments',
  ];

  const lines = [headers.map(csvCell).join(',')];
  for (const book of (books ?? []) as AlphaExportBookRow[]) {
    const bookEvents = eventsByBook.get(book.id) ?? [];
    const bookFeedback = (feedbackByBook.get(book.id) ?? []).sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    const latest = bookFeedback[0];
    const values = [
      book.id,
      book.parent_id,
      book.status,
      book.goal,
      book.occasion_pack ?? '',
      book.purchased_tier ?? '',
      book.created_at,
      previewReachedAt(book) ?? '',
      book.paid_at ?? '',
      book.completed_at ?? '',
      formatMinutes(minutesBetween(book.created_at, previewReachedAt(book))),
      formatMinutes(minutesBetween(book.paid_at, book.completed_at)),
      String(countEvents(bookEvents, 'preview_viewed')),
      String(countEvents(bookEvents, 'preview_page_changed')),
      String(countEvents(bookEvents, 'alpha_preview_saved')),
      String(countEvents(bookEvents, 'preview_share_created')),
      String(countEvents(bookEvents, 'preview_share_copied')),
      String(countEvents(bookEvents, 'preview_tweak_requested')),
      String(countEvents(bookEvents, 'download_pdf_clicked')),
      String(countEvents(bookEvents, 'download_audio_clicked')),
      latest ? String(latest.rating) : '',
      latest?.issue_type ?? '',
      latest ? String(latest.wants_full_book) : '',
      latest?.created_at ?? '',
      latest?.comments ?? '',
    ];
    lines.push(values.map(csvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
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

function avg(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function isNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / 60_000;
}

function previewReachedAt(book: Pick<BookMetricRow, 'status' | 'preview_ready_at' | 'updated_at'>): string | null {
  if (book.preview_ready_at) return book.preview_ready_at;
  if (book.status === 'preview_ready' || book.status === 'paid' || book.status === 'complete') return book.updated_at;
  return null;
}

function hasPreview(book: Pick<BookMetricRow, 'status' | 'preview_ready_at'>): boolean {
  return Boolean(book.preview_ready_at) || book.status === 'preview_ready' || book.status === 'paid' || book.status === 'complete';
}

function countEvents(rows: ProductEventRow[], event: string): number {
  return rows.filter((row) => row.event === event).length;
}

function formatMinutes(value: number | null): string {
  return value === null ? '' : String(round(value));
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

interface BookMetricRow {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  preview_ready_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
}

interface AlphaExportBookRow extends BookMetricRow {
  parent_id: string;
  goal: string;
  occasion_pack: string | null;
  purchased_tier: string | null;
}

interface ProductEventRow {
  book_id: string;
  event: string;
  created_at: string;
}

interface FeedbackMetricRow {
  book_id: string;
  rating: number;
  issue_type: string;
  wants_full_book: boolean;
  created_at: string;
}

interface FeedbackExportRow extends FeedbackMetricRow {
  comments: string | null;
}
