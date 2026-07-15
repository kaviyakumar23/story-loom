import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { assertBetaAccess } from '@/server/lib/beta-access';
import { badRequest } from '@/server/lib/errors';
import { toListItem, type BookRow } from '@/server/lib/mappers';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { isPdfSafe } from '@/server/lib/text';
import { EVENTS, inngest } from '@/server/pipeline/client';
import {
  AGE_BANDS,
  GOALS,
  LANGUAGES,
  OCCASION_PACKS,
  READING_LEVELS,
  type CreateBookResponse,
} from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOK_COLUMNS =
  'id, status, progress, goal, occasion_pack, language, reading_level, title, theme, purchased_tier, cover_asset_id, error, created_at, updated_at';

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
    avatar: z.object({
      skinTone: z.string().optional(),
      hair: z.string().optional(),
      hairColor: z.string().optional(),
      eyeColor: z.string().optional(),
      glasses: z.boolean().optional(),
      features: z.array(z.string()).max(20).optional(),
    }),
    interests: z.array(z.string().max(40)).max(10),
  }),
  goal: z.enum(GOALS),
  occasionPack: z.enum(OCCASION_PACKS).nullable().optional(),
  language: z.enum(LANGUAGES),
  readingLevel: z.enum(READING_LEVELS),
  consentId: z.string().uuid(),
});

// ---- POST /api/v1/books — create a book (idempotent per parent+key) ----
export async function POST(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    assertBetaAccess(req);
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid book payload', parsed.error.issues);
    const input = parsed.data;
    const db = serviceClient();

    // Idempotency (§5, §6): client key, else content + 10s bucket (double-submit guard).
    const header = req.headers.get('idempotency-key');
    const idempotencyKey = header?.trim() || deriveKey(parent.id, input);
    const { data: existing } = await db
      .from('books')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) {
      return Response.json({ bookId: existing.id, status: 'generating' } satisfies CreateBookResponse, { status: 202 });
    }

    // Abuse control (§6): cap previews per account per day.
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from('books')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parent.id)
      .gte('created_at', since);
    if ((count ?? 0) >= loadEnv().PREVIEW_DAILY_CAP) {
      throw badRequest('Daily preview limit reached. Please try again tomorrow.');
    }

    // Consent must exist and belong to this parent (§9).
    const { data: consent } = await db
      .from('consent_records')
      .select('id')
      .eq('id', input.consentId)
      .eq('parent_id', parent.id)
      .maybeSingle();
    if (!consent) throw badRequest('consentId is missing, invalid, or not yours');

    const { data: hero, error: heroErr } = await db
      .from('heroes')
      .insert({
        parent_id: parent.id,
        nickname: input.child.nickname,
        age_band: input.child.ageBand,
        avatar: input.child.avatar,
        interests: input.child.interests,
      })
      .select('id')
      .single();
    if (heroErr || !hero) throw badRequest('Could not create hero', heroErr?.message);

    const { data: book, error: bookErr } = await db
      .from('books')
      .insert({
        parent_id: parent.id,
        hero_id: hero.id,
        consent_id: input.consentId,
        goal: input.goal,
        occasion_pack: input.occasionPack ?? null,
        language: input.language,
        reading_level: input.readingLevel,
        status: 'generating',
        progress: 0,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single();
    if (bookErr || !book) throw badRequest('Could not create book', bookErr?.message);

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
    if (error) throw badRequest('Could not list books', error.message);
    const items = (data as BookRow[]).map(toListItem);
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
