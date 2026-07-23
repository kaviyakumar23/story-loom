import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { removePhotos } from '@/server/lib/photo-intake';
import { jsonError } from '@/server/lib/route';
import { removeAssets } from '@/server/lib/storage';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// ---- DELETE /api/v1/heroes/:id/likeness — remove a photo-derived likeness ----
//
// Purges the hero's character sheets (and their images) plus any pending photo,
// so the next book regenerates a fresh likeness from attributes only. Purchased
// books already printed/delivered are unaffected — their pages are fixed.
export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid hero id');

    const db = serviceClient();
    const { data: hero } = await db.from('heroes').select('id, parent_id').eq('id', id).maybeSingle();
    const h = hero as { id: string; parent_id: string } | null;
    if (!h) throw notFound('Hero not found');
    if (h.parent_id !== parent.id) throw forbidden();

    // Character sheets — gather their reference image keys (in the assets bucket),
    // delete the objects, then the rows.
    const { data: sheets } = await db.from('character_sheets').select('reference_pack').eq('hero_id', id);
    const sheetKeys: string[] = [];
    for (const row of (sheets ?? []) as { reference_pack?: { images?: { storageKey?: string }[] } }[]) {
      for (const img of row.reference_pack?.images ?? []) if (img.storageKey) sheetKeys.push(img.storageKey);
    }
    if (sheetKeys.length) await removeAssets(sheetKeys);
    await db.from('character_sheets').delete().eq('hero_id', id);

    // Any pending photo for this hero (ephemeral bucket) — delete object + row.
    const { data: photos } = await db.from('photo_uploads').select('id, storage_key').eq('hero_id', id).is('deleted_at', null);
    const photoRows = (photos ?? []) as { id: string; storage_key: string }[];
    if (photoRows.length) {
      await removePhotos(photoRows.map((p) => p.storage_key));
      const now = new Date().toISOString();
      await db.from('photo_uploads').update({ status: 'expired', deleted_at: now }).in('id', photoRows.map((p) => p.id));
    }

    await audit({ actor: 'parent', action: 'hero.likeness_removed', entity: 'heroes', entityId: id, metadata: { sheets: sheetKeys.length } });
    return Response.json({ ok: true, removedSheets: sheetKeys.length });
  } catch (err) {
    return jsonError(err);
  }
}
