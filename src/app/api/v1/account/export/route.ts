import { requireParent } from '@/server/auth';
import { audit } from '@/server/lib/audit';
import { assertRateLimit } from '@/server/lib/rate-limit';
import { jsonError } from '@/server/lib/route';
import { signAsset } from '@/server/lib/storage';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/account/export — DPDP access right (§9) ----
export async function GET(req: Request): Promise<Response> {
  try {
    const parent = await requireParent(req);
    // A full export reads every table and signs every asset — not something to
    // serve on a loop.
    assertRateLimit(`export:${parent.id}`, 3, 60_000);
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
    const heroIds = ((heroes.data ?? []) as { id: string }[]).map((hero) => hero.id);

    // The story text, the child's likeness, and the generated files are the bulk
    // of what we hold about the child — an access response without them is hollow.
    const [readingGuides, shareLinks, revisionRequests, pages, sheets, assets] = await Promise.all([
      bookIds.length ? db.from('book_reading_guides').select('*').in('book_id', bookIds) : empty(),
      bookIds.length
        ? db
            .from('book_share_links')
            .select('id, parent_id, book_id, expires_at, revoked_at, created_at')
            .eq('parent_id', parent.id)
        : empty(),
      bookIds.length ? db.from('book_revision_requests').select('*').eq('parent_id', parent.id) : empty(),
      bookIds.length ? db.from('book_pages').select('*').in('book_id', bookIds) : empty(),
      heroIds.length ? db.from('character_sheets').select('*').in('hero_id', heroIds) : empty(),
      bookIds.length || heroIds.length
        ? db
            .from('assets')
            .select('id, book_id, hero_id, type, mime, bytes, storage_key, created_at')
            .or(
              [
                bookIds.length ? `book_id.in.(${bookIds.join(',')})` : '',
                heroIds.length ? `hero_id.in.(${heroIds.join(',')})` : '',
              ]
                .filter(Boolean)
                .join(','),
            )
        : empty(),
    ]);

    // Signed links so the export is actually usable; they expire like any other
    // download link, and the storage key itself is internal so it is not shared.
    const assetRows = (assets.data ?? []) as {
      id: string;
      book_id: string | null;
      hero_id: string | null;
      type: string;
      mime: string | null;
      bytes: number | null;
      storage_key: string;
      created_at: string;
    }[];
    const assetsOut = await Promise.all(
      assetRows.map(async ({ storage_key, ...rest }) => ({
        ...rest,
        downloadUrl: await signAsset(storage_key),
      })),
    );

    await audit({ actor: 'parent', action: 'account.exported', entity: 'profiles', entityId: parent.id });

    return Response.json({
      exportedAt: new Date().toISOString(),
      profile: profile.data ?? null,
      consentRecords: consents.data ?? [],
      heroes: heroes.data ?? [],
      characterSheets: sheets.data ?? [],
      books: books.data ?? [],
      bookPages: pages.data ?? [],
      assets: assetsOut,
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

async function empty(): Promise<{ data: never[] }> {
  return { data: [] };
}
