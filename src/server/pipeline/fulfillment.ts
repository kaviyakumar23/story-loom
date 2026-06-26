import { loadEnv } from '../config/env';
import { priceFor } from '../config/pricing';
import { audit } from '../lib/audit';
import { imageCost, recordEvent } from '../lib/cost';
import { captureError } from '../lib/observability';
import { sendBookReady } from '../lib/email';
import { assemblePdf, type AssemblePage } from '../lib/pdf';
import { uploadAsset } from '../lib/storage';
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
  signKey,
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
    triggers: [{ event: EVENTS.fulfillmentRequested }],
  },
  async ({ event, step }) => {
    const bookId = (event.data as { bookId: string }).bookId;

    try {
      const ctx = await step.run('intake', async () => {
        await setProgress(bookId, 10);
        return loadContext(bookId);
      });

      // 8–9. Remaining interior pages (each moderated in renderAndStorePage).
      await step.run('remaining-pages', async () => renderRemaining(ctx));
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

async function renderRemaining(ctx: BookContext): Promise<void> {
  const db = serviceClient();
  const { data } = await db
    .from('book_pages')
    .select('page_index, illustration_prompt, image_asset_id')
    .eq('book_id', ctx.bookId)
    .is('image_asset_id', null)
    .order('page_index', { ascending: true });

  const pending = (data ?? []) as { page_index: number; illustration_prompt: string | null }[];
  if (!pending.length) return;

  const reference = await resolveCharacterSheet(ctx);
  for (const p of pending) {
    const { model } = await renderAndStorePage(
      ctx,
      p.page_index,
      p.illustration_prompt ?? '',
      reference,
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
}

async function assemble(ctx: BookContext): Promise<void> {
  const db = serviceClient();

  const [{ data: book }, { data: pageRows }, { data: assetRows }] = await Promise.all([
    db.from('books').select('title, cover_asset_id').eq('id', ctx.bookId).single(),
    db
      .from('book_pages')
      .select('page_index, text, image_asset_id')
      .eq('book_id', ctx.bookId)
      .order('page_index', { ascending: true }),
    db.from('assets').select('id, storage_key').eq('book_id', ctx.bookId).eq('type', 'image'),
  ]);

  const keyById = new Map(
    ((assetRows ?? []) as { id: string; storage_key: string }[]).map((a) => [a.id, a.storage_key]),
  );

  const pages: AssemblePage[] = [];
  for (const p of (pageRows ?? []) as {
    page_index: number;
    text: string;
    image_asset_id: string | null;
  }[]) {
    const key = p.image_asset_id ? keyById.get(p.image_asset_id) : undefined;
    pages.push({ text: p.text, imageUrl: key ? await signKey(key) : null });
  }

  const coverId = (book as { cover_asset_id: string | null }).cover_asset_id;
  const coverKey = coverId ? keyById.get(coverId) : undefined;
  const pdf = await assemblePdf({
    title: (book as { title: string | null }).title ?? 'Your Story',
    coverImageUrl: coverKey ? await signKey(coverKey) : null,
    pages,
  });

  const key = `books/${ctx.bookId}/book.pdf`;
  await uploadAsset(key, pdf, 'application/pdf');
  await upsertAsset(ctx.bookId, 'pdf', key, 'application/pdf');
  await recordEvent({ bookId: ctx.bookId, stage: 'assemble', status: 'ok' });
}

async function synthesizeAudio(ctx: BookContext): Promise<void> {
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
  await db.from('books').update({ status: 'complete', progress: 100 }).eq('id', ctx.bookId);
  await audit({ actor: 'system', action: 'book.delivered', entity: 'books', entityId: ctx.bookId });

  const { data } = await db.auth.admin.getUserById(ctx.parentId);
  const email = data.user?.email;
  if (email) {
    const base = loadEnv().APP_BASE_URL;
    try {
      await sendBookReady(email, `${base}/books/${ctx.bookId}`);
    } catch {
      // Delivery email is best-effort; the book is already available in-dashboard.
    }
  }
}

/** Insert a delivery asset, or replace an existing one of the same type (idempotent). */
async function upsertAsset(
  bookId: string,
  type: 'pdf' | 'audio',
  storageKey: string,
  mime: string,
): Promise<void> {
  const db = serviceClient();
  await db.from('assets').delete().eq('book_id', bookId).eq('type', type);
  const { error } = await db
    .from('assets')
    .insert({ book_id: bookId, type, storage_key: storageKey, mime });
  if (error) throw new Error(`persist ${type} asset failed: ${error.message}`);
}
