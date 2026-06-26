import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { toBook, type BookRow } from '@/server/lib/mappers';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOK_COLUMNS =
  'id, status, progress, goal, language, reading_level, title, theme, purchased_tier, cover_asset_id, error, created_at, updated_at';

type Ctx = { params: Promise<{ id: string }> };

// ---- GET /api/v1/books/:id ----
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    const row = await loadOwnedBook(id, parent.id);
    return Response.json(await toBook(row));
  } catch (err) {
    return jsonError(err);
  }
}

// ---- DELETE /api/v1/books/:id — soft-delete (erasure support) ----
export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    const row = await loadOwnedBook(id, parent.id);
    await serviceClient().from('books').update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    await audit({ actor: 'parent', action: 'book.deleted', entity: 'books', entityId: row.id });
    return new Response(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}

async function loadOwnedBook(id: string, parentId: string): Promise<BookRow> {
  if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid book id');
  const { data, error } = await serviceClient()
    .from('books')
    .select(BOOK_COLUMNS + ', parent_id, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw badRequest('Could not load book', error.message);
  const row = data as unknown as (BookRow & { parent_id: string; deleted_at: string | null }) | null;
  if (!row || row.deleted_at) throw notFound('Book not found');
  if (row.parent_id !== parentId) throw forbidden();
  return row;
}
