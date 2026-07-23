import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest } from '@/server/lib/errors';
import { loadEditableTarget } from '@/server/lib/editing';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { isPdfSafe } from '@/server/lib/text';
import { EVENTS, inngest } from '@/server/pipeline/client';
import { getProviders } from '@/server/providers/index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A page's printed text — bounded, PDF-encodable (it goes straight into the book).
const bodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(800)
    .refine(isPdfSafe, {
      message: 'This text can only use Latin letters and common punctuation for now — that’s what we can print.',
    }),
});

type Ctx = { params: Promise<{ id: string; index: string }> };

// ---- PATCH /api/v1/books/:id/pages/:index — edit a page's text (free) ----
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id, index } = await ctx.params;
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid page edit', parsed.error.issues);

    const target = await loadEditableTarget(id, index, parent.id);

    // This edit is the only gate before the text is printed and narrated, so it
    // fails closed: any moderation verdict other than "allowed" blocks it.
    const verdict = await getProviders().moderator.moderateText([parsed.data.text]);
    if (!verdict.allowed) {
      throw badRequest('That wording can’t be used in a children’s book. Please rephrase and try again.');
    }

    const db = serviceClient();
    await db
      .from('book_pages')
      .update({ text: parsed.data.text })
      .eq('book_id', target.bookId)
      .eq('page_index', target.pageIndex);
    // Mark the book as re-assembling so the reader can show an "updating…" state.
    await db.from('books').update({ editing_at: new Date().toISOString() }).eq('id', target.bookId);

    await audit({ actor: 'parent', action: 'book.page_edited', entity: 'books', entityId: target.bookId, metadata: { pageIndex: target.pageIndex, mode: 'text' } });
    await inngest.send({ name: EVENTS.editApplied, data: { bookId: target.bookId, pageIndex: target.pageIndex, mode: 'text' } });

    return Response.json({ ok: true, mode: 'text', pageIndex: target.pageIndex }, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
