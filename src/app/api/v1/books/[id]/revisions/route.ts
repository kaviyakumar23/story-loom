import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, conflict, forbidden, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';
import type { CreateBookRevisionResponse } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const revisionSchema = z.object({
  instruction: z.string().trim().min(8).max(400),
});

type Ctx = { params: Promise<{ id: string }> };

// ---- POST /api/v1/books/:id/revisions — one free preview tweak before checkout ----
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    const parsed = revisionSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid revision payload', parsed.error.issues);

    const book = await loadOwnedRevisionableBook(id, parent.id);
    const db = serviceClient();
    const { count } = await db
      .from('book_revision_requests')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', book.id);
    if ((count ?? 0) >= 1) throw conflict('This preview already used its free tweak.');

    const { data: revision, error: revisionErr } = await db
      .from('book_revision_requests')
      .insert({
        parent_id: parent.id,
        book_id: book.id,
        instruction: parsed.data.instruction,
      })
      .select('id')
      .single();
    if (revisionErr || !revision) {
      if (revisionErr?.code === '23505') throw conflict('This preview already used its free tweak.');
      throw internal('Could not request preview tweak', revisionErr?.message);
    }

    const { error: bookErr } = await db
      .from('books')
      .update({
        status: 'generating',
        progress: 0,
        error: null,
        preview_ready_at: null,
      })
      .eq('id', book.id);
    if (bookErr) throw internal('Could not restart preview generation', bookErr.message);

    await audit({
      actor: 'parent',
      action: 'book.revision_requested',
      entity: 'books',
      entityId: book.id,
      metadata: { revisionId: (revision as { id: string }).id },
    });
    await inngest.send({
      name: EVENTS.previewRequested,
      data: { bookId: book.id, correlationId: randomUUID() },
    });

    return Response.json(
      { ok: true, revisionId: (revision as { id: string }).id } satisfies CreateBookRevisionResponse,
      { status: 202 },
    );
  } catch (err) {
    return jsonError(err);
  }
}

async function loadOwnedRevisionableBook(id: string, parentId: string): Promise<{ id: string }> {
  if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid book id');
  const { data, error } = await serviceClient()
    .from('books')
    .select('id, parent_id, status, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw internal('Could not load book', error.message);
  const row = data as { id: string; parent_id: string; status: string; deleted_at: string | null } | null;
  if (!row || row.deleted_at) throw notFound('Book not found');
  if (row.parent_id !== parentId) throw forbidden();
  if (row.status !== 'preview_ready') {
    throw badRequest('The free tweak is available only after preview and before checkout.');
  }
  return { id: row.id };
}
