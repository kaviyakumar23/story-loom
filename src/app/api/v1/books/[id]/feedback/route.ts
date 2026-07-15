import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { badRequest, forbidden, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { FEEDBACK_ISSUE_TYPES } from '@/server/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  issueType: z.enum(FEEDBACK_ISSUE_TYPES).default('none'),
  comments: z.string().max(1000).optional(),
  wantsFullBook: z.boolean().optional().default(false),
});

type Ctx = { params: Promise<{ id: string }> };

// ---- POST /api/v1/books/:id/feedback — internal alpha tester feedback ----
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid book id');

    const parsed = feedbackSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid feedback payload', parsed.error.issues);

    const db = serviceClient();
    const { data: book, error: bookErr } = await db
      .from('books')
      .select('id, parent_id, deleted_at')
      .eq('id', id)
      .maybeSingle();
    if (bookErr) throw internal('Could not load book', bookErr.message);

    const row = book as { id: string; parent_id: string; deleted_at: string | null } | null;
    if (!row || row.deleted_at) throw notFound('Book not found');
    if (row.parent_id !== parent.id) throw forbidden();

    const comments = parsed.data.comments?.trim() || null;
    const { error } = await db.from('book_feedback').insert({
      parent_id: parent.id,
      book_id: row.id,
      rating: parsed.data.rating,
      issue_type: parsed.data.issueType,
      comments,
      wants_full_book: parsed.data.wantsFullBook,
    });
    if (error) throw internal('Could not record feedback', error.message);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
