import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { assertBetaAccess } from '@/server/lib/beta-access';
import { badRequest, internal } from '@/server/lib/errors';
import { toListItem, type BookRow } from '@/server/lib/mappers';
import { assertRateLimit } from '@/server/lib/rate-limit';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { isPdfSafe } from '@/server/lib/text';
import { EVENTS, inngest } from '@/server/pipeline/client';
import { getProviders, resolveModelStamp } from '@/server/providers/index';
import {
  AGE_BANDS,
  GOALS,
  LANGUAGES,
  OCCASION_PACKS,
  READING_LEVELS,
  type BookStatus,
  type CreateBookResponse,
} from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOK_COLUMNS =
  'id, status, progress, goal, occasion_pack, language, reading_level, title, theme, purchased_tier, cover_asset_id, error, created_at, updated_at, hero_id, series_number';

const createSchema = z.object({
  child: z.object({
    // The nickname is printed into the PDF, whose standard fonts encode WinAnsi
    // only. Reject here, at the door, rather than after the parent has paid and
    // fulfillment throws — and never silently mangle a child's name.
    nickname: z
      .string()
      .min(1)
      .max(40)
      .refine(isPdfSafe, {
        message:
          'Nickname can only use Latin letters and common punctuation for now — we cannot print other scripts in the book yet.',
      }),
    ageBand: z.enum(AGE_BANDS),
    // Attributes are fixed chips in the UI — pin them server-side too, so the
    // descriptor that reaches the image model can't carry arbitrary free text.
    avatar: z.object({
      skinTone: z.enum(['fair', 'light', 'medium', 'tan', 'deep']).optional(),
      hair: z.enum(['short', 'curly', 'long', 'braids', 'none']).optional(),
      hairColor: z.string().max(30).optional(),
      eyeColor: z.string().max(30).optional(),
      glasses: z.boolean().optional(),
      features: z.array(z.string().max(40)).max(20).optional(),
    }),
    interests: z.array(z.string().max(40)).max(10),
    // Month only (1–12), never a full DOB — enables birthday nudges (§9 minimisation).
    birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  }),
  goal: z.enum(GOALS),
  occasionPack: z.enum(OCCASION_PACKS).nullable().optional(),
  // Optional parent-authored theme. Not printed directly (the model's output is),
  // so it need not be PDF-safe — just bounded and stripped of control chars.
  // Injection is handled at the prompt layer (delimited <theme>, brackets stripped).
  customTheme: z
    .string()
    .max(200)
    .transform((t) => t.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim())
    .optional(),
  language: z.enum(LANGUAGES),
  readingLevel: z.enum(READING_LEVELS),
  consentId: z.string().uuid(),
  marketingConsent: z.boolean().optional(),
  // Reuse an existing hero (repeat purchase). When set, the child fields above
  // are ignored and the cached character sheet is reused.
  heroId: z.string().uuid().optional(),
  // Optional, consent-gated photo upload to seed a stylized likeness (Phase 4).
  photoUploadId: z.string().uuid().optional(),
});

// ---- POST /api/v1/books — create a book (idempotent per parent+key) ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    assertBetaAccess(req);
    // Defence in depth over the daily cap: keep a burst from spending money
    // faster than the cap's re-check can withdraw it.
    assertRateLimit(`books:${parent.id}`, 10, 60_000);
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid book payload', parsed.error.issues);
    const input = parsed.data;
    const db = serviceClient();

    // Idempotency (§5, §6): client key, else content + 10s bucket (double-submit guard).
    const header = req.headers.get('idempotency-key');
    const idempotencyKey = header?.trim() || deriveKey(parent.id, input);
    const { data: existing } = await db
      .from('books')
      .select('id, status')
      .eq('parent_id', parent.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; status: BookStatus };
      return Response.json({ bookId: row.id, status: row.status } satisfies CreateBookResponse, { status: 202 });
    }

    // Abuse control (§6): cap previews per account per day. This read is only
    // advisory — see the authoritative re-check after the insert below.
    const cap = loadEnv().PREVIEW_DAILY_CAP;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from('books')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parent.id)
      .gte('created_at', since);
    if ((count ?? 0) >= cap) {
      throw badRequest('Daily preview limit reached. Please try again tomorrow.');
    }

    // Consent must exist, belong to this parent, and still stand (§9). A
    // withdrawn consent authorizes nothing further (DPDP §6).
    const { data: consent } = await db
      .from('consent_records')
      .select('id, withdrawn_at')
      .eq('id', input.consentId)
      .eq('parent_id', parent.id)
      .maybeSingle();
    if (!consent) throw badRequest('consentId is missing, invalid, or not yours');
    if ((consent as { withdrawn_at: string | null }).withdrawn_at) {
      throw badRequest('This consent has been withdrawn. Please give consent again to make a new book.');
    }

    // Pre-moderate free-text inputs (theme + interests) so bad content is a
    // friendly 400 here rather than a burned preview that dead-ends at the output
    // gate. Reject only on a real content flag — if moderation is merely
    // unavailable, fall through and let the fail-closed output gates (gateText,
    // image moderation) be the backstop, so a transient outage can't take down
    // the whole create funnel.
    const freeText = [input.customTheme, ...input.child.interests].filter(
      (t): t is string => typeof t === 'string' && t.trim().length > 0,
    );
    if (freeText.length) {
      const verdict = await getProviders().moderator.moderateText(freeText);
      const onlyUnavailable = verdict.reasons.every(
        (r) => r === 'moderation_unavailable' || r === 'openai_not_configured',
      );
      if (!verdict.allowed && !onlyUnavailable) {
        throw badRequest('That story theme or interest can’t be used. Please rephrase and try again.');
      }
    }

    // Opt-in comms — only ever flips consent on, never off, and only by the owner.
    if (input.marketingConsent) {
      await db.from('profiles').update({ marketing_consent: true }).eq('id', parent.id);
    }

    // Reuse an existing hero ("another book for the same child") so the cached
    // character sheet carries over — book two structurally stars the same child.
    // Otherwise create a fresh hero.
    let heroId: string;
    let createdHero = false;
    if (input.heroId) {
      const { data: existing } = await db
        .from('heroes')
        .select('id')
        .eq('id', input.heroId)
        .eq('parent_id', parent.id)
        .maybeSingle();
      if (!existing) throw badRequest('heroId is invalid or not yours');
      heroId = input.heroId;
    } else {
      const { data: hero, error: heroErr } = await db
        .from('heroes')
        .insert({
          parent_id: parent.id,
          nickname: input.child.nickname,
          age_band: input.child.ageBand,
          avatar: input.child.avatar,
          interests: input.child.interests,
          birth_month: input.child.birthMonth ?? null,
        })
        .select('id')
        .single();
      if (heroErr || !hero) throw internal('Could not create hero', heroErr?.message);
      heroId = hero.id;
      createdHero = true;
    }
    // Roll back only a hero WE created — never a reused one (it has other books).
    const cleanupHero = async () => { if (createdHero) await db.from('heroes').delete().eq('id', heroId); };

    // Link a consented photo upload to this hero, so the pipeline seeds a stylized
    // likeness from it (once) and then deletes it. Owner + approved + unconsumed only.
    if (input.photoUploadId) {
      await db
        .from('photo_uploads')
        .update({ hero_id: heroId })
        .eq('id', input.photoUploadId)
        .eq('parent_id', parent.id)
        .eq('status', 'approved')
        .is('consumed_at', null);
    }

    const stamp = resolveModelStamp();
    const { data: book, error: bookErr } = await db
      .from('books')
      .insert({
        parent_id: parent.id,
        hero_id: heroId,
        consent_id: input.consentId,
        goal: input.goal,
        occasion_pack: input.occasionPack ?? null,
        custom_theme: input.customTheme || null,
        language: input.language,
        reading_level: input.readingLevel,
        status: 'generating',
        progress: 0,
        idempotency_key: idempotencyKey,
        // Freeze the model config so preview + paid render stay identical (§7).
        model_tier: stamp.modelTier,
        text_model: stamp.textModel,
        image_model: stamp.imageModel,
        prompt_version: stamp.promptVersion,
      })
      .select('id')
      .single();
    if (bookErr || !book) {
      // Lost the idempotency race. uq_books_idempotency means a concurrent
      // request for the same key already made this book — double-submit is
      // exactly what the key is for, so return theirs instead of a 400.
      if (bookErr?.code === '23505') {
        await cleanupHero();
        const { data: winner } = await db
          .from('books')
          .select('id, status')
          .eq('parent_id', parent.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (winner) {
          const row = winner as { id: string; status: BookStatus };
          return Response.json({ bookId: row.id, status: row.status } satisfies CreateBookResponse, { status: 202 });
        }
      }
      await cleanupHero();
      throw internal('Could not create book', bookErr?.message);
    }

    // Authoritative cap check. The pre-check is a read, so N parallel requests
    // can all pass it; this asks a question they all answer identically — "is my
    // book among the oldest `cap` in the window?" — so the losers withdraw
    // themselves rather than each burning a preview's worth of model spend.
    const { data: withinCap } = await db
      .from('books')
      .select('id')
      .eq('parent_id', parent.id)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(cap);
    if (!((withinCap ?? []) as { id: string }[]).some((b) => b.id === book.id)) {
      // Order matters: books.hero_id is ON DELETE RESTRICT.
      await db.from('books').delete().eq('id', book.id);
      await cleanupHero();
      throw badRequest('Daily preview limit reached. Please try again tomorrow.');
    }

    await audit({ actor: 'parent', action: 'book.created', entity: 'books', entityId: book.id, metadata: { goal: input.goal } });
    await inngest.send({ name: EVENTS.previewRequested, data: { bookId: book.id, correlationId: randomUUID() } });

    return Response.json({ bookId: book.id, status: 'generating' } satisfies CreateBookResponse, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}

// ---- GET /api/v1/books — owner-scoped, paginated ----
export async function GET(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const sp = new URL(req.url).searchParams;
    const limit = clamp(Number.parseInt(sp.get('limit') ?? '', 10) || 50, 1, 100);
    const offset = Math.max(0, Number.parseInt(sp.get('offset') ?? '', 10) || 0);

    const { data, error } = await serviceClient()
      .from('books')
      .select(BOOK_COLUMNS)
      .eq('parent_id', parent.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw internal('Could not list books', error.message);
    const rows = data as BookRow[];
    // Batch-load hero nicknames so the dashboard can group books into per-child
    // shelves (avoids PostgREST embedding ambiguity).
    const heroIds = [...new Set(rows.map((r) => r.hero_id).filter((x): x is string => Boolean(x)))];
    const { data: heroes } = heroIds.length
      ? await serviceClient().from('heroes').select('id, nickname').in('id', heroIds)
      : { data: [] as { id: string; nickname: string }[] };
    const nickById = new Map(((heroes ?? []) as { id: string; nickname: string }[]).map((h) => [h.id, h.nickname]));
    const items = rows.map((r) => toListItem(r, r.hero_id ? nickById.get(r.hero_id) ?? null : null));
    return Response.json({ books: items, nextOffset: items.length === limit ? offset + limit : null });
  } catch (err) {
    return jsonError(err);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function deriveKey(parentId: string, input: unknown): string {
  const bucket = Math.floor(Date.now() / 10_000);
  return createHash('sha256').update(`${parentId}:${bucket}:${JSON.stringify(input)}`).digest('hex');
}
