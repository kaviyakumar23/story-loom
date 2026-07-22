import { requireParent } from '@/server/auth';
import { forbidden, notFound } from '@/server/lib/errors';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/books/[id]/reuse — the hero details to start another book ----
// Powers "another book for the same child": returns the existing hero so the
// create form can prefill and reuse it (its cached character sheet carries over).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await params;
    const db = serviceClient();

    const { data: book } = await db.from('books').select('parent_id, hero_id').eq('id', id).maybeSingle();
    if (!book) throw notFound('Book not found');
    const b = book as { parent_id: string; hero_id: string };
    if (b.parent_id !== parent.id) throw forbidden();

    const { data: hero } = await db
      .from('heroes')
      .select('id, nickname, age_band, avatar, interests, birth_month')
      .eq('id', b.hero_id)
      .maybeSingle();
    if (!hero) throw notFound('Hero not found');
    const h = hero as {
      id: string; nickname: string; age_band: string;
      avatar: Record<string, unknown>; interests: string[]; birth_month: number | null;
    };

    return Response.json({
      heroId: h.id,
      nickname: h.nickname,
      ageBand: h.age_band,
      avatar: h.avatar ?? {},
      interests: h.interests ?? [],
      birthMonth: h.birth_month,
    });
  } catch (err) {
    return jsonError(err);
  }
}
