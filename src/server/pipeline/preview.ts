import { textCost, imageCost, recordEvent } from '../lib/cost';
import { captureError } from '../lib/observability';
import { getProviders } from '../providers/index';
import { HERO_TOKEN, scrubAll } from '../lib/tokenize';
import { EVENTS, inngest } from './client';
import {
  gateText,
  loadContext,
  markLatestRevision,
  markFailed,
  pageCountFor,
  persistStory,
  PREVIEW_PAGE_COUNT,
  renderAndStorePage,
  resolveCharacterSheet,
  setProgress,
  type BookContext,
} from './helpers';

/**
 * Phase A — Preview (§6). Runs on book creation, BEFORE payment. Produces just
 * enough to show a compelling free preview (~5 images): cover + first few pages.
 * We only pay full generation cost for paying customers (phase B).
 */
export const previewPipeline = inngest.createFunction(
  {
    id: 'preview-pipeline',
    name: 'Preview generation',
    retries: 2,
    // One run per book at a time — a double-submitted preview would otherwise
    // pay for the same images twice.
    concurrency: { key: 'event.data.bookId', limit: 1 },
    triggers: [{ event: EVENTS.previewRequested }],
  },
  async ({ event, step }) => {
    const bookId = (event.data as { bookId: string }).bookId;

    try {
      // 1. Intake
      const ctx = await step.run('intake', async () => {
        await setProgress(bookId, 5, 'generating');
        await markLatestRevision(bookId, 'running');
        return loadContext(bookId);
      });

      // 2. Story + Gate #1 (moderate text/prompts before any image spend)
      const plan = await step.run('story', async () => buildStory(ctx));
      await setProgress(bookId, 35);

      // 3. Character sheet. Kept separate so slow image providers do not force
      // the entire preview render into one long serverless invocation.
      await step.run('character-sheet', async () => {
        await resolveCharacterSheet(ctx);
        await setProgress(bookId, 45);
      });

      // 4. Cover + Gate #3 (rendered image moderation).
      await step.run('render-cover', async () => {
        const reference = await resolveCharacterSheet(ctx);
        const { model } = await renderAndStorePage(ctx, -1, plan.coverPrompt, reference, true);
        await recordEvent({
          bookId,
          stage: 'images',
          model,
          images: 1,
          costUsd: imageCost(model, 1),
          status: 'ok',
        });
        await setProgress(bookId, 55);
      });

      // 5–6. Preview pages + Gate #3, one provider call per step.
      let done = 0;
      for (const page of plan.previewPages) {
        await step.run(`render-preview-page-${page.index}`, async () => {
          const reference = await resolveCharacterSheet(ctx);
          const { model } = await renderAndStorePage(ctx, page.index, page.prompt, reference);
          await recordEvent({
            bookId,
            stage: 'images',
            model,
            images: 1,
            costUsd: imageCost(model, 1),
            status: 'ok',
          });
        });
        done += 1;
        await setProgress(bookId, 55 + Math.round((done / plan.previewPages.length) * 40));
      }

      // 7. Preview ready
      await step.run('finalize', async () => {
        await setProgress(bookId, 100, 'preview_ready');
        await markLatestRevision(bookId, 'completed');
      });
      return { bookId, status: 'preview_ready' };
    } catch (err) {
      // Moderation blocks already mark failed; this catches anything else.
      const message = err instanceof Error ? err.message : String(err);
      captureError(err, { stage: 'preview', bookId, correlationId: (event.data as { correlationId?: string }).correlationId });
      await step.run('mark-failed', async () => markFailed(bookId, 'preview_failed', message));
      throw err;
    }
  },
);

interface StoryPlan {
  title: string;
  coverPrompt: string;
  previewPages: { index: number; prompt: string }[];
}

async function buildStory(ctx: BookContext): Promise<StoryPlan> {
  const { text } = getProviders();
  const result = await text.generateStory({
    heroToken: HERO_TOKEN,
    ageBand: ctx.ageBand,
    readingLevel: ctx.readingLevel,
    goal: ctx.goal,
    occasionPack: ctx.occasionPack,
    // Scrub the child's name out of free-text interests before it reaches the
    // model, and guard the whole payload against it (§9).
    interests: scrubAll(ctx.interests, ctx.nickname),
    pageCount: pageCountFor(ctx.readingLevel),
    revisionInstruction: ctx.revisionInstruction ? scrubAll([ctx.revisionInstruction], ctx.nickname)[0] : null,
    guard: [ctx.nickname],
  });
  const story = result.value;

  await recordEvent({
    bookId: ctx.bookId,
    stage: 'story',
    model: result.usage.model,
    tokensIn: result.usage.tokensIn,
    tokensOut: result.usage.tokensOut,
    costUsd: textCost(result.usage.model, result.usage.tokensIn, result.usage.tokensOut),
    status: 'ok',
  });

  // Gate #1 — moderate full story text + per-page illustration prompts.
  await gateText(
    ctx.bookId,
    [story.title, story.theme, ...story.pages.flatMap((p) => [p.text, p.illustrationPrompt])],
  );
  await recordEvent({ bookId: ctx.bookId, stage: 'safety', status: 'ok' });

  await persistStory(ctx, story);

  return {
    title: story.title,
    coverPrompt:
      `Picture-book cover illustration for "${story.title}". Theme: ${story.theme}. ` +
      `The hero child featured prominently, warm and inviting, no text.`,
    previewPages: story.pages
      .filter((p) => p.index < PREVIEW_PAGE_COUNT)
      .map((p) => ({ index: p.index, prompt: p.illustrationPrompt })),
  };
}
