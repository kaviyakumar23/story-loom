import { z } from 'zod';
import { loadEnv } from '@/server/config/env';
import { requireAdmin } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { sendBookReady } from '@/server/lib/email';
import { badRequest, internal, notFound } from '@/server/lib/errors';
import { jsonError, readJson } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deliverSchema = z.object({
  pdfStorageKey: z.string().min(1),
  audioStorageKey: z.string().min(1).optional(),
});

/**
 * A storage key must live under the book it is being attached to. Without this,
 * any key would bind — including another family's `books/{other}/book.pdf`,
 * which mappers would then sign for THIS book's parent. One typo behind a single
 * shared admin secret should not be able to hand one family another's book.
 */
function assertKeyBelongsToBook(key: string, bookId: string, label: string): void {
  if (!key.startsWith(`books/${bookId}/`) || key.includes('..')) {
    throw badRequest(`${label} must be a storage key under books/${bookId}/`);
  }
}

// ---- POST /api/v1/admin/books/:id/deliver — complete manual fulfillment ----
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw badRequest('Invalid id');
    const parsed = deliverSchema.safeParse(await readJson(req));
    if (!parsed.success) throw badRequest('Invalid deliver payload', parsed.error.issues);
    assertKeyBelongsToBook(parsed.data.pdfStorageKey, id, 'pdfStorageKey');
    if (parsed.data.audioStorageKey) {
      assertKeyBelongsToBook(parsed.data.audioStorageKey, id, 'audioStorageKey');
    }
    const db = serviceClient();

    const { data: book } = await db.from('books').select('id, parent_id, purchased_tier').eq('id', id).maybeSingle();
    if (!book) throw notFound('Book not found');
    if (!(book as { purchased_tier: string | null }).purchased_tier) throw badRequest('Book has not been paid for');

    const assetRows = [{ book_id: id, type: 'pdf', storage_key: parsed.data.pdfStorageKey, mime: 'application/pdf' }];
    if (parsed.data.audioStorageKey) {
      assetRows.push({ book_id: id, type: 'audio', storage_key: parsed.data.audioStorageKey, mime: 'audio/mpeg' });
    }
    const { error: assetErr } = await db.from('assets').insert(assetRows);
    if (assetErr) throw internal('Could not persist assets', assetErr.message);

    await db
      .from('books')
      .update({ status: 'complete', progress: 100, completed_at: new Date().toISOString() })
      .eq('id', id);
    await audit({ actor: 'admin', action: 'book.delivered', entity: 'books', entityId: id, metadata: { hasAudio: Boolean(parsed.data.audioStorageKey) } });

    const { data: user } = await db.auth.admin.getUserById((book as { parent_id: string }).parent_id);
    if (user.user?.email) {
      try {
        await sendBookReady(user.user.email, `${loadEnv().APP_BASE_URL}/books/${id}`);
      } catch {
        /* best-effort */
      }
    }

    return Response.json({ ok: true, status: 'complete' });
  } catch (err) {
    return jsonError(err);
  }
}
