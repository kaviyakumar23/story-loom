import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { badRequest, forbidden, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { BOOK_EVENT_NAMES } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  event: z.enum(BOOK_EVENT_NAMES),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

type Ctx = { params: Promise<{ id: string }> };

// ---- POST /api/v1/books/:id/events — parent behavior telemetry for alpha measurement ----
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid book id');

    const parsed = eventSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid event payload', parsed.error.issues);

    const db = serviceClient();
    const { data: book, error: bookErr } = await db
      .from('books')
      .select('id, parent_id, deleted_at')
      .eq('id', id)
      .maybeSingle();
    if (bookErr) throw badRequest('Could not load book', bookErr.message);

    const row = book as { id: string; parent_id: string; deleted_at: string | null } | null;
    if (!row || row.deleted_at) throw notFound('Book not found');
    if (row.parent_id !== parent.id) throw forbidden();

    const { error } = await db.from('book_events').insert({
      parent_id: parent.id,
      book_id: row.id,
      event: parsed.data.event,
      metadata: parsed.data.metadata,
    });
    if (error) throw badRequest('Could not record event', error.message);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
