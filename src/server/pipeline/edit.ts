import { NonRetriableError } from 'inngest';
import { loadEnv } from '../config/env';
import { priceFor } from '../config/pricing';
import { imageCost, recordEvent } from '../lib/cost';
import { captureError } from '../lib/observability';
import { uploadAsset } from '../lib/storage';
import { serviceClient } from '../lib/supabase';
import { humanizeHeroToken, scrubAll } from '../lib/tokenize';
import { getProviders } from '../providers/index';
import type { Tier } from '../types/api';
import { EVENTS, inngest, type EditApplied } from './client';
import { assemble, synthesizeAudio } from './fulfillment';
import { loadContext, resolveCharacterSheet, type BookContext } from './helpers';

/**
 * Apply a parent's post-purchase page edit (§ preview-and-edit). Triggered after
 * the edit endpoint has already persisted the change (text) or debited a render
 * credit (image). This step rebuilds the digital PDF so the download reflects
 * the edit, and — for an image edit — re-renders the one page.
 *
 * It deliberately does NOT go through the delivery path: the book stays
 * `complete`, no email is re-sent, and a blocked re-render keeps the old image
 * rather than failing the whole (already-delivered) book.
 */
export const applyBookEdit = inngest.createFunction(
  {
    id: 'apply-book-edit',
    name: 'Apply a parent page edit',
    retries: 2,
    // One edit per book at a time; a small global cap (edits are infrequent and
    // must not crowd out preview/fulfilment renders on the provider).
    concurrency: [{ key: 'event.data.bookId', limit: 1 }, { limit: 2 }],
    triggers: [{ event: EVENTS.editApplied }],
  },
  async ({ event, step }) => {
    const { bookId, pageIndex, mode, instruction } = event.data as EditApplied['data'];

    try {
      const ctx = await step.run('intake', async () => loadContext(bookId));

      let changed = mode === 'text';
      if (mode === 'image') {
        const regenerated = await step.run(`regen-page-${pageIndex}`, async () =>
          regenPageImage(ctx, pageIndex, instruction),
        );
        changed = regenerated;
        if (!regenerated) {
          // Blocked after retries → refund the credit; the old image stands.
          await step.run('refund-credit', async () => refundCredit(bookId));
        }
      }

      // Rebuild the PDF (and audio, for a text edit on an audio tier) only when
      // something actually changed. Assemble reads current pages, so it reflects
      // the edit; it hard-fails on a missing image, which can't happen here since
      // every page already rendered before the book reached `complete`.
      if (changed) {
        await step.run('reassemble', async () => assemble(ctx));
        if (mode === 'text' && ctx.purchasedTier && priceFor(ctx.purchasedTier as Tier).includesAudio) {
          await step.run('reaudio', async () => synthesizeAudio(ctx));
        }
      }

      await step.run('finish', async () => clearEditing(bookId));
      return { bookId, mode, changed };
    } catch (err) {
      captureError(err, { stage: 'edit', bookId, correlationId: (event.data as { correlationId?: string }).correlationId });
      // Always clear the editing flag so the reader doesn't spin forever.
      await step.run('clear-editing-on-error', async () => clearEditing(bookId));
      throw err;
    }
  },
);

/**
 * Re-render a single page's illustration, anchored to the cached character sheet
 * (never regenerated) so the fixed page stays on-model with the rest of the book.
 * Returns true on success; false if moderation blocked it after every attempt —
 * in which case the OLD image is left untouched. Never marks the book failed.
 */
async function regenPageImage(
  ctx: BookContext,
  pageIndex: number,
  instruction?: string | null,
): Promise<boolean> {
  const db = serviceClient();
  const { data: page } = await db
    .from('book_pages')
    .select('illustration_prompt')
    .eq('book_id', ctx.bookId)
    .eq('page_index', pageIndex)
    .maybeSingle();
  if (!page) throw new NonRetriableError(`Page ${pageIndex} not found for book ${ctx.bookId}`);

  const reference = await resolveCharacterSheet(ctx);
  const provider = getProviders({ imageModel: ctx.imageModel }).image;
  const maxAttempts = loadEnv().MAX_IMAGE_ATTEMPTS;

  const basePrompt = (page as { illustration_prompt: string | null }).illustration_prompt ?? '';
  // The optional parent tweak is untrusted free text → scrub the child's name and
  // strip delimiters before it reaches the image model.
  const note = instruction ? scrubAll([instruction], ctx.nickname)[0].replace(/[<>]/g, ' ').trim() : '';
  let scenePrompt = humanizeHeroToken(note ? `${basePrompt} Parent note: ${note}.` : basePrompt);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { value, usage } = await provider.renderPage(scenePrompt, reference);
    const verdict = await getProviders().moderator.moderateImage({ base64: value.base64, mime: value.mime });
    if (!verdict.allowed) {
      await recordEvent({ bookId: ctx.bookId, stage: 'images', attempt, model: usage.model, images: 0, status: 'retried' });
      scenePrompt = `${humanizeHeroToken(basePrompt)} Keep it gentle, warm, and strictly child-safe — no scary, violent, or unsafe elements.`;
      continue;
    }

    const ext = value.mime === 'image/jpeg' ? 'jpg' : 'png';
    const key = `books/${ctx.bookId}/pages/${pageIndex}.${ext}`;
    await uploadAsset(key, Buffer.from(value.base64, 'base64'), value.mime);
    const { data: asset, error } = await db
      .from('assets')
      .insert({ book_id: ctx.bookId, type: 'image', storage_key: key, mime: value.mime })
      .select('id')
      .single();
    if (error || !asset) throw new Error(`persist regen asset failed: ${error?.message}`);

    // Swap only now that the new image passed moderation — the old image stayed
    // intact until this point, so a failed regen never breaks the book or PDF.
    await db.from('book_pages').update({ image_asset_id: asset.id }).eq('book_id', ctx.bookId).eq('page_index', pageIndex);
    await recordEvent({ bookId: ctx.bookId, stage: 'images', model: usage.model, images: 1, costUsd: imageCost(usage.model, 1), status: 'ok' });
    return true;
  }

  // Exhausted attempts — keep the old image, never fail the delivered book.
  return false;
}

/** Give back a regeneration credit when a re-render was blocked. */
async function refundCredit(bookId: string): Promise<void> {
  const db = serviceClient();
  const { data } = await db.from('books').select('render_credits').eq('id', bookId).maybeSingle();
  const current = (data as { render_credits: number } | null)?.render_credits ?? 0;
  await db.from('books').update({ render_credits: current + 1 }).eq('id', bookId);
}

async function clearEditing(bookId: string): Promise<void> {
  await serviceClient().from('books').update({ editing_at: null }).eq('id', bookId);
}
