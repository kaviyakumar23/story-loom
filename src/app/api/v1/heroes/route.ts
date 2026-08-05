import { requireParent } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import type { HeroListItem, ListHeroesResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/heroes — the parent's heroes, metadata only ----
//
// Exists so the account page can offer the privacy policy's "remove a
// photo-based likeness" right: each hero reports whether an illustrated
// character exists and what it was made from. Nickname + likeness source only —
// no avatar details, no photo data (there are no photo bytes to expose anyway).
export async function GET(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const db = serviceClient();

    const { data: heroes } = await db
      .from('heroes')
      .select('id, nickname')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: true });
    const rows = (heroes ?? []) as { id: string; nickname: string }[];
    if (!rows.length) return Response.json({ heroes: [] } satisfies ListHeroesResponse);

    const { data: sheets } = await db
      .from('character_sheets')
      .select('hero_id, source')
      .in('hero_id', rows.map((h) => h.id));
    const sourceByHero = new Map<string, string>();
    for (const s of (sheets ?? []) as { hero_id: string; source: string | null }[]) {
      // A hero can have several sheet rows; 'photo' wins because that is the one
      // the parent has a right to remove.
      if (s.source === 'photo' || !sourceByHero.has(s.hero_id)) sourceByHero.set(s.hero_id, s.source ?? 'attributes');
    }

    const out: HeroListItem[] = rows.map((h) => {
      const source = sourceByHero.get(h.id);
      return {
        id: h.id,
        nickname: h.nickname,
        likeness: source === 'photo' ? 'photo' : source ? 'attributes' : null,
      };
    });
    return Response.json({ heroes: out } satisfies ListHeroesResponse);
  } catch (err) {
    return jsonError(err);
  }
}
