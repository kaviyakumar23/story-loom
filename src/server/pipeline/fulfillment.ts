import { createHash } from 'node:crypto';
import { loadEnv } from '../config/env';
import { priceFor } from '../config/pricing';
import { audit } from '../lib/audit';
import { imageCost, recordEvent } from '../lib/cost';
import { captureError } from '../lib/observability';
import { sendBookReady, sendPrintReady } from '../lib/email';
import { assemblePdf, type AssemblePage } from '../lib/pdf';
import { buildCasewrap } from '../lib/casewrap';
import { buildPrintInterior } from '../lib/print-pdf';
import { preflight } from '../lib/print-preflight';
import { downloadAsset, uploadAsset } from '../lib/storage';
import { serviceClient } from '../lib/supabase';
import { getProviders } from '../providers/index';
import type { Tier } from '../types/api';
import { EVENTS, inngest } from './client';
import {
  buildScript,
  loadContext,
  markFailed,
  renderAndStorePage,
  resolveCharacterSheet,
  setProgress,
  type BookContext,
} from './helpers';

/**
 * Phase B — Fulfillment (§6). Runs ONLY after a verified payment (triggered by
 * the Razorpay webhook). Generates the remaining pages, assembles the PDF,
 * optionally synthesizes audio, and delivers. Must tolerate webhook redelivery —
 * every step is idempotent.
 */
export const fulfillmentPipeline = inngest.createFunction(
  {
    id: 'fulfillment-pipeline',
    name: 'Fulfillment generation',
    retries: 2,
    // One run per book at a time. The reconcile cron re-enqueues books that look
    // stuck, so without this a slow run and its reconciliation could render the
    // same pages twice (double image spend, duplicate asset rows, two emails).
    // The second, keyless limit is a function-global cap on heavy paid renders.
    concurrency: [{ key: 'event.data.bookId', limit: 1 }, { limit: 3 }],
    triggers: [{ event: EVENTS.fulfillmentRequested }],
  },
  async ({ event, step }) => {
    const bookId = (event.data as { bookId: string }).bookId;

    try {
      const ctx = await step.run('intake', async () => {
        await setProgress(bookId, 10);
        return loadContext(bookId);
      });

      // 8–9. Remaining interior pages, one provider call per step.
      const pending = await step.run('remaining-pages-list', async () => loadPendingPages(ctx.bookId));
      let done = 0;
      for (const page of pending) {
        await step.run(`render-page-${page.page_index}`, async () => renderRemainingPage(ctx, page));
        done += 1;
        if (pending.length) {
          await setProgress(bookId, 20 + Math.round((done / pending.length) * 50));
        }
      }
      await setProgress(bookId, 70);

      // 10. Assemble print-quality PDF.
      await step.run('assemble', async () => assemble(ctx));
      await setProgress(bookId, 85);

      // 11. Audio, only if the purchased tier includes it.
      if (ctx.purchasedTier && priceFor(ctx.purchasedTier as Tier).includesAudio) {
        await step.run('audio', async () => synthesizeAudio(ctx));
        await setProgress(bookId, 95);
      }

      // 12. Deliver.
      await step.run('deliver', async () => deliver(ctx));
      return { bookId, status: 'complete' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      captureError(err, { stage: 'fulfillment', bookId, correlationId: (event.data as { correlationId?: string }).correlationId });
      await step.run('mark-failed', async () => markFailed(bookId, 'fulfillment_failed', message));
      throw err;
    }
  },
);

interface PendingPage {
  page_index: number;
  illustration_prompt: string | null;
}

async function loadPendingPages(bookId: string): Promise<PendingPage[]> {
  const { data } = await serviceClient()
    .from('book_pages')
    .select('page_index, illustration_prompt, image_asset_id')
    .eq('book_id', bookId)
    .is('image_asset_id', null)
    .order('page_index', { ascending: true });

  return (data ?? []) as PendingPage[];
}

async function renderRemainingPage(ctx: BookContext, page: PendingPage): Promise<void> {
  const reference = await resolveCharacterSheet(ctx);
  const { model } = await renderAndStorePage(
    ctx,
    page.page_index,
    page.illustration_prompt ?? '',
    reference,
    false,
    // These pages are destined for paper, so they are asked for at print size
    // and held to the resolution floor before storage.
    isPhysical(ctx) ? 'print' : 'preview',
  );
  await recordEvent({
    bookId: ctx.bookId,
    stage: 'images',
    model,
    images: 1,
    costUsd: imageCost(model, 1),
    status: 'ok',
  });
}

/** Whether this book ships as an object rather than a file. */
function isPhysical(ctx: BookContext): boolean {
  return Boolean(ctx.purchasedTier && priceFor(ctx.purchasedTier as Tier).physical);
}

export async function assemble(ctx: BookContext): Promise<void> {
  const db = serviceClient();

  const [{ data: book }, { data: pageRows }, { data: assetRows }, { data: giftOrder }] = await Promise.all([
    db.from('books').select('title, cover_asset_id, series_number').eq('id', ctx.bookId).single(),
    db
      .from('book_pages')
      .select('page_index, text, image_asset_id')
      .eq('book_id', ctx.bookId)
      .order('page_index', { ascending: true }),
    db.from('assets').select('id, storage_key').eq('book_id', ctx.bookId).eq('type', 'image'),
    db
      .from('orders')
      .select('gift_message, is_gift')
      .eq('book_id', ctx.bookId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const keyById = new Map(
    ((assetRows ?? []) as { id: string; storage_key: string }[]).map((a) => [a.id, a.storage_key]),
  );

  // Every illustration must be present and readable. A missing one means an
  // earlier step didn't finish, and the honest outcome is a failed book an admin
  // can rerun — never a silently text-only PDF sent to someone who paid.
  const fetchImage = async (assetId: string | null, label: string): Promise<Buffer> => {
    const key = assetId ? keyById.get(assetId) : undefined;
    if (!key) throw new Error(`Cannot assemble ${ctx.bookId}: ${label} has no illustration`);
    const bytes = await downloadAsset(key);
    if (!bytes) throw new Error(`Cannot assemble ${ctx.bookId}: ${label} image ${key} could not be read`);
    return bytes;
  };

  const rows = (pageRows ?? []) as { page_index: number; text: string; image_asset_id: string | null }[];
  const [coverImage, pages] = await Promise.all([
    fetchImage((book as { cover_asset_id: string | null }).cover_asset_id, 'cover'),
    Promise.all(
      rows.map(async (p): Promise<AssemblePage> => ({
        text: p.text,
        image: await fetchImage(p.image_asset_id, `page ${p.page_index}`),
      })),
    ),
  ]);

  const seriesNumber = (book as { series_number: number | null }).series_number;
  const gift = giftOrder as { gift_message: string | null; is_gift: boolean } | null;
  const title = (book as { title: string | null }).title ?? 'Your Story';
  const series = seriesNumber ? { number: seriesNumber, heroName: ctx.nickname } : undefined;

  if (isPhysical(ctx)) {
    await assemblePrintMaster(ctx, { title, coverImage, pages, series });
    return;
  }

  const pdf = await assemblePdf({
    title,
    coverImage,
    pages,
    series,
    giftMessage: gift?.is_gift ? gift.gift_message : null,
  });

  const key = `books/${ctx.bookId}/book.pdf`;
  await uploadAsset(key, pdf, 'application/pdf');
  await upsertAsset(ctx.bookId, 'pdf', key, 'application/pdf');
  await recordEvent({ bookId: ctx.bookId, stage: 'assemble', status: 'ok' });
}

/**
 * Build the file a printer receives, and the evidence that it is printable.
 *
 * The preflight report is stored beside the master rather than merely logged: it
 * is what the release gate reads before a book is sent, and what a defect is
 * traced back to afterwards. A master that fails preflight is not stored at all
 * — an unusable file in the print queue is worse than a book that visibly
 * failed, because the first one gets printed.
 */
async function assemblePrintMaster(
  ctx: BookContext,
  input: { title: string; coverImage: Buffer; pages: AssemblePage[]; series?: { number: number; heroName: string } },
): Promise<void> {
  const { pdf, lowestPpi, pageCount } = await buildPrintInterior({
    title: input.title,
    coverImage: input.coverImage,
    pages: input.pages.map((p) => ({ text: p.text, image: p.image })),
    dedication: ctx.dedication,
    series: input.series ?? null,
    bookId: ctx.bookId,
  });

  const report = await preflight(pdf, 'interior');
  if (!report.ok) {
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    throw new Error(`Print master for ${ctx.bookId} failed preflight — ${failed.join('; ')}`);
  }

  const key = `books/${ctx.bookId}/print/interior.pdf`;
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  await uploadAsset(key, pdf, 'application/pdf');
  await upsertAsset(ctx.bookId, 'print_master', key, 'application/pdf', sha256);

  const reportKey = `books/${ctx.bookId}/print/preflight.json`;
  await uploadAsset(reportKey, Buffer.from(JSON.stringify(report, null, 2)), 'application/json');
  await upsertAsset(ctx.bookId, 'preflight', reportKey, 'application/json');

  // The case is a separate sheet from the block, and its width depends on how
  // thick this particular book is — so it is built per book, not once.
  const wrapPdf = await buildCasewrap({ title: input.title });
  const wrapKey = `books/${ctx.bookId}/print/casewrap.pdf`;
  await uploadAsset(wrapKey, wrapPdf, 'application/pdf');
  await upsertAsset(ctx.bookId, 'casewrap', wrapKey, 'application/pdf', createHash('sha256').update(wrapPdf).digest('hex'));

  await audit({
    actor: 'system',
    action: 'print.master_built',
    entity: 'books',
    entityId: ctx.bookId,
    metadata: { sha256, pageCount, lowestPpi },
  });
  await recordEvent({ bookId: ctx.bookId, stage: 'assemble', status: 'ok' });
}

export async function synthesizeAudio(ctx: BookContext): Promise<void> {
  const script = await buildScript(ctx.bookId);
  const audio = await getProviders().audio.synthesize(script);
  const key = `books/${ctx.bookId}/audio.mp3`;
  await uploadAsset(key, audio.buffer, audio.mime);
  await upsertAsset(ctx.bookId, 'audio', key, audio.mime);
  await recordEvent({
    bookId: ctx.bookId,
    stage: 'fulfillment',
    model: audio.usage.model,
    status: 'ok',
  });
}

async function deliver(ctx: BookContext): Promise<void> {
  const db = serviceClient();
  // Already delivered (a reconciled re-run of a finished book) — don't email twice.
  const { data: current } = await db.from('books').select('status').eq('id', ctx.bookId).maybeSingle();
  if ((current as { status: string } | null)?.status === 'complete') return;

  await db
    .from('books')
    .update({ status: 'complete', progress: 100, completed_at: new Date().toISOString() })
    .eq('id', ctx.bookId);
  await audit({ actor: 'system', action: 'book.delivered', entity: 'books', entityId: ctx.bookId });

  // Physical tiers: the digital PDF is delivered instantly (above); the printed
  // book now enters the founder's fulfilment queue as 'print_ready'.
  await ensurePrintFulfillment(ctx, db);

  const { data } = await db.auth.admin.getUserById(ctx.parentId);
  const email = data.user?.email;
  if (email) {
    const base = loadEnv().APP_BASE_URL;
    const physical = Boolean(ctx.purchasedTier && priceFor(ctx.purchasedTier as Tier).physical);
    try {
      if (physical) await sendPrintReady(email, `${base}/books/${ctx.bookId}`);
      else await sendBookReady(email, `${base}/books/${ctx.bookId}`);
    } catch {
      // Delivery email is best-effort; the book is already available in-dashboard.
    }
  }
}

/**
 * Queue the printed book for manual founder fulfilment once it's paid + complete.
 * Idempotent (unique book_id+kind); the print master is the assembled book.pdf.
 */
async function ensurePrintFulfillment(ctx: BookContext, db: ReturnType<typeof serviceClient>): Promise<void> {
  if (!ctx.purchasedTier || !priceFor(ctx.purchasedTier as Tier).physical) return;

  const { data: order } = await db
    .from('orders')
    .select('id')
    .eq('book_id', ctx.bookId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return; // no paid order found — nothing to fulfil physically

  const orderId = (order as { id: string }).id;
  const { data: addr } = await db
    .from('shipping_addresses')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  await db.from('fulfillments').upsert(
    {
      book_id: ctx.bookId,
      order_id: orderId,
      address_id: addr ? (addr as { id: string }).id : null,
      kind: 'print',
      status: 'print_ready',
      // The press file, not the reader's copy — those are different artifacts now.
      print_master_key: `books/${ctx.bookId}/print/interior.pdf`,
    },
    { onConflict: 'book_id,kind' },
  );
  await audit({ actor: 'system', action: 'fulfillment.queued', entity: 'books', entityId: ctx.bookId });
}

/** Insert a delivery asset, or replace an existing one of the same type (idempotent). */
async function upsertAsset(
  bookId: string,
  type: 'pdf' | 'audio' | 'print_master' | 'preflight' | 'casewrap',
  storageKey: string,
  mime: string,
  sha256?: string,
): Promise<void> {
  const db = serviceClient();
  await db.from('assets').delete().eq('book_id', bookId).eq('type', type);
  const { error } = await db
    .from('assets')
    .insert({ book_id: bookId, type, storage_key: storageKey, mime, ...(sha256 ? { sha256 } : {}) });
  if (error) throw new Error(`persist ${type} asset failed: ${error.message}`);
}
