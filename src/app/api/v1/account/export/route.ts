import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/account/export — DPDP access right (§9) ----
export async function GET(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    const db = serviceClient();

    const [profile, consents, heroes, books, orders, bookEvents, bookFeedback] = await Promise.all([
      db.from('profiles').select('*').eq('id', parent.id).maybeSingle(),
      db.from('consent_records').select('*').eq('parent_id', parent.id),
      db.from('heroes').select('*').eq('parent_id', parent.id),
      db.from('books').select('*').eq('parent_id', parent.id),
      db.from('orders').select('*').eq('parent_id', parent.id),
      db.from('book_events').select('*').eq('parent_id', parent.id),
      db.from('book_feedback').select('*').eq('parent_id', parent.id),
    ]);
    const bookIds = ((books.data ?? []) as { id: string }[]).map((book) => book.id);
    const [readingGuides, shareLinks, revisionRequests] = bookIds.length
      ? await Promise.all([
          db.from('book_reading_guides').select('*').in('book_id', bookIds),
          db
            .from('book_share_links')
            .select('id, parent_id, book_id, expires_at, revoked_at, created_at')
            .eq('parent_id', parent.id),
          db.from('book_revision_requests').select('*').eq('parent_id', parent.id),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    await audit({ actor: 'parent', action: 'account.exported', entity: 'profiles', entityId: parent.id });

    return Response.json({
      exportedAt: new Date().toISOString(),
      profile: profile.data ?? null,
      consentRecords: consents.data ?? [],
      heroes: heroes.data ?? [],
      books: books.data ?? [],
      orders: orders.data ?? [],
      bookEvents: bookEvents.data ?? [],
      bookFeedback: bookFeedback.data ?? [],
      readingGuides: readingGuides.data ?? [],
      shareLinks: shareLinks.data ?? [],
      revisionRequests: revisionRequests.data ?? [],
    });
  } catch (err) {
    return jsonError(err);
  }
}
