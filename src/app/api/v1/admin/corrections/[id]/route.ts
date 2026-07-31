import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, conflict, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
  // Why, in the founder's words. On a rejection this is what the parent is told,
  // so "we can't add a real photo of your dog" beats a silent no.
  note: z.string().trim().max(500).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// ---- POST /api/v1/admin/corrections/:id — approve or decline one correction ----
//
// Approving is what actually starts the regeneration: the parent's request only
// filed an intent. Declining closes it with a reason and consumes the book's one
// correction, so a request can't be re-litigated indefinitely.
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid correction id');
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid decision', parsed.error.issues);

    const db = serviceClient();
    const { data } = await db
      .from('book_revision_requests')
      .select('id, book_id, status')
      .eq('id', id)
      .maybeSingle();
    const row = data as { id: string; book_id: string; status: string } | null;
    if (!row) throw notFound('Correction not found');
    if (row.status !== 'pending_review') throw conflict(`This correction was already ${row.status}.`);

    const approve = parsed.data.decision === 'approve';
    const reviewedAt = new Date().toISOString();

    // Conditional update: two admins hitting approve at once must not queue the
    // same regeneration twice — the second finds no row to move.
    const { data: claimed } = await db
      .from('book_revision_requests')
      .update({
        status: approve ? 'queued' : 'rejected',
        reviewed_at: reviewedAt,
        review_note: parsed.data.note ?? null,
      })
      .eq('id', id)
      .eq('status', 'pending_review')
      .select('id');
    if (!claimed?.length) throw conflict('This correction was already reviewed.');

    if (approve) {
      const { error: bookErr } = await db
        .from('books')
        .update({ status: 'generating', progress: 0, error: null, preview_ready_at: null })
        .eq('id', row.book_id);
      if (bookErr) throw internal('Could not restart preview generation', bookErr.message);
      await inngest.send({
        name: EVENTS.previewRequested,
        data: { bookId: row.book_id, correlationId: randomUUID() },
      });
    }

    await audit({
      actor: 'admin',
      action: approve ? 'correction.approved' : 'correction.rejected',
      entity: 'book_revision_requests',
      entityId: id,
      metadata: { bookId: row.book_id, note: parsed.data.note ?? null },
    });

    return Response.json({ ok: true, status: approve ? 'queued' : 'rejected' });
  } catch (err) {
    return jsonError(err);
  }
}
