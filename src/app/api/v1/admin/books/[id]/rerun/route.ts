import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, notFound } from '@/server/lib/errors';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- POST /api/v1/admin/books/:id/rerun — re-run after review (§5, §12) ----
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid id');
    const db = serviceClient();

    const { data: book } = await db.from('books').select('id, purchased_tier').eq('id', id).maybeSingle();
    if (!book) throw notFound('Book not found');

    const paid = Boolean((book as { purchased_tier: string | null }).purchased_tier);
    const patch: Record<string, unknown> = {
      status: 'generating',
      progress: 0,
      error: null,
      completed_at: null,
    };
    if (!paid) patch.preview_ready_at = null;
    await db
      .from('books')
      .update(patch)
      .eq('id', id);
    await inngest.send({ name: paid ? EVENTS.fulfillmentRequested : EVENTS.previewRequested, data: { bookId: id } });
    await audit({ actor: 'admin', action: 'book.rerun', entity: 'books', entityId: id, metadata: { paid } });

    return Response.json({ ok: true, status: 'generating', phase: paid ? 'fulfillment' : 'preview' });
  } catch (err) {
    return jsonError(err);
  }
}
