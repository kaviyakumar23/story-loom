import { NonRetriableError } from 'inngest';
import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { recordEvent } from '../lib/cost';
import { detokenizeLocal, HERO_TOKEN, scrubAll } from '../lib/tokenize';
import { downloadAsset, signAsset, uploadAsset } from '../lib/storage';
import { serviceClient } from '../lib/supabase';
import { getProviders } from '../providers/index';
import type { CharacterReferencePack, Story } from '../providers/types';
import type { AgeBand, Goal, OccasionPackId, ReadingLevel } from '../types/api';

/** Cover + first N interior pages make the free preview (§6 phase A). */
export const PREVIEW_PAGE_COUNT = 3;

export function pageCountFor(level: ReadingLevel): number {
  return level === 'emerging' ? 8 : level === 'early' ? 10 : 12;
}

export interface BookContext {
  bookId: string;
  parentId: string;
  heroId: string;
  nickname: string;
  ageBand: AgeBand;
  avatar: Record<string, unknown>;
  interests: string[];
  goal: Goal;
  occasionPack: OccasionPackId | null;
  readingLevel: ReadingLevel;
  purchasedTier: string | null;
  revisionInstruction: string | null;
}

export async function loadContext(bookId: string): Promise<BookContext> {
  const db = serviceClient();
  const { data: book } = await db
    .from('books')
    .select('id, parent_id, hero_id, goal, occasion_pack, reading_level, purchased_tier')
    .eq('id', bookId)
    .maybeSingle();
  if (!book) throw new NonRetriableError(`Book ${bookId} not found`);

  const { data: hero } = await db
    .from('heroes')
    .select('id, nickname, age_band, avatar, interests')
    .eq('id', (book as { hero_id: string }).hero_id)
    .maybeSingle();
  if (!hero) throw new NonRetriableError(`Hero for book ${bookId} not found`);

  const b = book as {
    parent_id: string;
    hero_id: string;
    goal: Goal;
    occasion_pack: OccasionPackId | null;
    reading_level: ReadingLevel;
    purchased_tier: string | null;
  };
  const h = hero as {
    nickname: string;
    age_band: AgeBand;
    avatar: Record<string, unknown>;
    interests: string[];
  };
  return {
    bookId,
    parentId: b.parent_id,
    heroId: b.hero_id,
    nickname: h.nickname,
    ageBand: h.age_band,
    avatar: h.avatar ?? {},
    interests: h.interests ?? [],
    goal: b.goal,
    occasionPack: b.occasion_pack ?? null,
    readingLevel: b.reading_level,
    purchasedTier: b.purchased_tier,
    revisionInstruction: await loadLatestRevisionInstruction(bookId),
  };
}

export async function setProgress(
  bookId: string,
  progress: number,
  status?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { progress };
  if (status) {
    patch.status = status;
    if (status === 'preview_ready') patch.preview_ready_at = new Date().toISOString();
    if (status === 'complete') patch.completed_at = new Date().toISOString();
  }
  await serviceClient().from('books').update(patch).eq('id', bookId);
}

export async function markFailed(bookId: string, code: string, message: string): Promise<void> {
  await serviceClient()
    .from('books')
    .update({ status: 'failed', error: { code, message } })
    .eq('id', bookId);
  await markLatestRevision(bookId, 'failed', message);
}

/**
 * Persist the generated story. All pages are stored now (phase A); only the
 * preview ones get images in phase A. The real name is injected LOCALLY here —
 * the model only ever saw the {{HERO}} placeholder (§9).
 */
export async function persistStory(ctx: BookContext, story: Story): Promise<void> {
  const db = serviceClient();
  await db.from('books').update({ title: story.title, theme: story.theme }).eq('id', ctx.bookId);
  const { error: guideErr } = await db.from('book_reading_guides').upsert(
    {
      book_id: ctx.bookId,
      vocabulary: story.vocabulary,
      discussion_questions: story.discussionQuestions,
      activity: story.activity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'book_id' },
  );
  if (guideErr) throw new Error(`persistGuide failed: ${guideErr.message}`);

  const rows = story.pages.map((p) => ({
    book_id: ctx.bookId,
    page_index: p.index,
    text: detokenizeLocal(p.text, { [HERO_TOKEN]: ctx.nickname }),
    illustration_prompt: p.illustrationPrompt,
    is_preview: p.index < PREVIEW_PAGE_COUNT,
  }));
  // Upsert keeps re-runs idempotent (unique on book_id, page_index).
  const { error } = await db.from('book_pages').upsert(rows, { onConflict: 'book_id,page_index' });
  if (error) throw new Error(`persistStory failed: ${error.message}`);
}

export async function markLatestRevision(
  bookId: string,
  status: 'running' | 'completed' | 'failed',
  error?: string,
): Promise<void> {
  const db = serviceClient();
  const { data } = await db
    .from('book_revision_requests')
    .select('id, status')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; status: string } | null;
  if (!row || row.status === 'completed' || row.status === 'failed') return;

  const patch: Record<string, unknown> = { status };
  if (status === 'completed') patch.completed_at = new Date().toISOString();
  if (status === 'failed') {
    patch.completed_at = new Date().toISOString();
    patch.error = error ?? 'Preview revision failed';
  }
  await db.from('book_revision_requests').update(patch).eq('id', row.id);
}

async function loadLatestRevisionInstruction(bookId: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from('book_revision_requests')
    .select('instruction')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { instruction?: string } | null)?.instruction ?? null)?.trim() || null;
}

/**
 * Resolve the hero's character sheet: reuse the cached reference pack if present
 * (cheaper + more consistent for repeat books — §7), else generate and cache it.
 * Reference images live in object storage; the DB row keeps only the keys so
 * erasure can purge the underlying files.
 */
export async function resolveCharacterSheet(ctx: BookContext): Promise<CharacterReferencePack> {
  const db = serviceClient();
  const { data: existing } = await db
    .from('character_sheets')
    .select('reference_pack')
    .eq('hero_id', ctx.heroId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const stored = (existing as { reference_pack?: StoredReferencePack } | null)?.reference_pack;
  if (stored?.images?.length) {
    // Cache hit: reference images live in object storage — re-hydrate to base64.
    const images = await Promise.all(
      stored.images.map(async (img) => {
        const bytes = await downloadAsset(img.storageKey);
        return bytes ? { view: img.view, mime: img.mime, base64: bytes.toString('base64') } : null;
      }),
    );
    const live = images.filter((i): i is NonNullable<typeof i> => i !== null);
    if (live.length) {
      return {
        images: live,
        palette: stored.palette,
        clothingTokens: stored.clothingTokens,
        negativeConstraints: stored.negativeConstraints,
      };
    }
    // Fall through to regenerate if the objects went missing.
  }

  const { value, usage } = await getProviders().image.generateCharacterSheet({
    // Scrub the child's name out of free-text avatar features before it reaches
    // the image model, and guard the payload against it (§9).
    avatar: scrubAvatar(ctx.avatar, ctx.nickname),
    ageBand: ctx.ageBand,
    guard: [ctx.nickname],
  });

  // Persist reference images to object storage; keep only keys in the DB row
  // (no fat base64 jsonb). Reused to anchor every page — the cached, cheap path.
  const storedImages: StoredReferencePack['images'] = [];
  for (const img of value.images) {
    const ext = img.mime === 'image/jpeg' ? 'jpg' : 'png';
    const key = `heroes/${ctx.heroId}/sheet/${img.view}.${ext}`;
    await uploadAsset(key, Buffer.from(img.base64, 'base64'), img.mime);
    storedImages.push({ view: img.view, storageKey: key, mime: img.mime });
  }
  const toStore: StoredReferencePack = {
    images: storedImages,
    palette: value.palette,
    clothingTokens: value.clothingTokens,
    negativeConstraints: value.negativeConstraints,
  };
  await db.from('character_sheets').insert({
    hero_id: ctx.heroId,
    version: 1,
    reference_pack: toStore,
    model_used: usage.model,
  });
  return value;
}

/** DB representation of the character bible — image keys, not inline base64. */
interface StoredReferencePack {
  images: { view: string; storageKey: string; mime: string }[];
  palette: string[];
  clothingTokens: string[];
  negativeConstraints: string[];
}

/** Render one page image, anchored to the character sheet, and persist it. */
export async function renderAndStorePage(
  ctx: BookContext,
  pageIndex: number,
  prompt: string,
  reference: CharacterReferencePack,
  isCover = false,
): Promise<{ model: string; attempts: number }> {
  const provider = getProviders().image;
  const maxAttempts = loadEnv().MAX_IMAGE_ATTEMPTS;
  let scenePrompt = prompt;
  let lastReasons: string[] = [];

  // Render → moderate (gate #3). On a moderation block, regenerate with tighter
  // constraints up to the cap, then route to human review (§6 cost cap, §10).
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { value, usage } = await provider.renderPage(scenePrompt, reference);
    const verdict = await getProviders().moderator.moderateImage({
      base64: value.base64,
      mime: value.mime,
    });

    if (!verdict.allowed) {
      lastReasons = verdict.reasons;
      // Log the wasted attempt so the retry-inflation metric can see it (§12).
      await recordEvent({
        bookId: ctx.bookId,
        stage: 'images',
        attempt,
        model: usage.model,
        images: 0,
        status: 'retried',
      });
      // Tighten the prompt before retrying.
      scenePrompt = `${prompt} Keep it gentle, warm, and strictly child-safe — no scary, violent, or unsafe elements.`;
      continue;
    }

    const ext = value.mime === 'image/jpeg' ? 'jpg' : 'png';
    const key = isCover
      ? `books/${ctx.bookId}/cover.${ext}`
      : `books/${ctx.bookId}/pages/${pageIndex}.${ext}`;
    await uploadAsset(key, Buffer.from(value.base64, 'base64'), value.mime);

    const db = serviceClient();
    const { data: asset, error } = await db
      .from('assets')
      .insert({ book_id: ctx.bookId, type: 'image', storage_key: key, mime: value.mime })
      .select('id')
      .single();
    if (error || !asset) throw new Error(`persist image asset failed: ${error?.message}`);

    if (isCover) {
      await db.from('books').update({ cover_asset_id: asset.id }).eq('id', ctx.bookId);
    } else {
      await db
        .from('book_pages')
        .update({ image_asset_id: asset.id })
        .eq('book_id', ctx.bookId)
        .eq('page_index', pageIndex);
    }
    return { model: usage.model, attempts: attempt };
  }

  // Exhausted the cap and still blocked → human review (§10).
  return routeToReview(ctx.bookId, 'image', lastReasons);
}

// ---- Moderation gates (§10) ----

export async function gateText(bookId: string, texts: string[]): Promise<void> {
  const verdict = await getProviders().moderator.moderateText(texts);
  if (!verdict.allowed) await routeToReview(bookId, 'text', verdict.reasons);
}

// Image moderation (gate #3) is inlined into renderAndStorePage so it can
// regenerate up to MAX_IMAGE_ATTEMPTS before routing to review (§6, §10).

async function routeToReview(bookId: string, kind: string, reasons: string[]): Promise<never> {
  await markFailed(bookId, 'moderation_blocked', `Blocked at ${kind} gate: ${reasons.join('; ')}`);
  await audit({
    actor: 'system',
    action: 'moderation.blocked',
    entity: 'books',
    entityId: bookId,
    metadata: { kind, reasons, queue: 'human_review' },
  });
  // Non-retriable: do not auto-retry a safety block; a human reviews it (§10).
  throw new NonRetriableError(`Moderation blocked (${kind}): ${reasons.join('; ')}`);
}

/** Build the narration script for audio from the (already-localized) page text. */
export async function buildScript(bookId: string): Promise<string> {
  const { data } = await serviceClient()
    .from('book_pages')
    .select('text, page_index')
    .eq('book_id', bookId)
    .order('page_index', { ascending: true });
  return ((data ?? []) as { text: string }[]).map((p) => p.text).join('\n\n');
}

/** Resolve a signed URL for a storage key, for PDF assembly. */
export async function signKey(storageKey: string): Promise<string | null> {
  return signAsset(storageKey, 60 * 30);
}

/** Scrub the child's name out of free-text avatar fields (features) (§9). */
function scrubAvatar(avatar: Record<string, unknown>, name: string): Record<string, unknown> {
  const features = avatar.features;
  if (Array.isArray(features)) {
    return { ...avatar, features: scrubAll(features.map(String), name) };
  }
  return avatar;
}
