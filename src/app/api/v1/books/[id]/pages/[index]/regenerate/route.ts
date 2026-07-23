import { z } from 'zod';
import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { badRequest, conflict } from '@/server/lib/errors';
import { loadEditableTarget } from '@/server/lib/editing';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';
import { EVENTS, inngest } from '@/server/pipeline/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Optional steer for the re-render, e.g. "make it night-time". Untrusted free
  // text — scrubbed and delimiter-stripped before it reaches the image model.
  instruction: z.string().trim().max(200).optional(),
});

type Ctx = { params: Promise<{ id: string; index: string }> };

// ---- POST /api/v1/books/:id/pages/:index/regenerate — re-render one page ----
// Debits a render credit (images are ~90% of cost). The credit is refunded in
// the pipeline if the re-render is blocked by moderation.
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const { id, index } = await ctx.params;
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid regenerate request', parsed.error.issues);

    const target = await loadEditableTarget(id, index, parent.id);
    if (target.renderCredits <= 0) {
      throw conflict('You’ve used all the illustration regenerations included with this book.');
    }

    const db = serviceClient();
    // Compare-and-swap debit: only succeeds if the credit count is still what we
    // read, so two concurrent requests can't both spend the same credit.
    const { data: debited } = await db
      .from('books')
      .update({ render_credits: target.renderCredits - 1, editing_at: new Date().toISOString() })
      .eq('id', target.bookId)
      .eq('render_credits', target.renderCredits)
      .select('id');
    if (!debited || debited.length === 0) {
      throw conflict('Please wait for the current change to finish before regenerating again.');
    }

    await audit({ actor: 'parent', action: 'book.page_regenerated', entity: 'books', entityId: target.bookId, metadata: { pageIndex: target.pageIndex, mode: 'image' } });
    await inngest.send({
      name: EVENTS.editApplied,
      data: { bookId: target.bookId, pageIndex: target.pageIndex, mode: 'image', instruction: parsed.data.instruction ?? null },
    });

    return Response.json(
      { ok: true, mode: 'image', pageIndex: target.pageIndex, renderCreditsRemaining: target.renderCredits - 1 },
      { status: 202 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
