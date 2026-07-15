import { audit } from './audit';
import { removeAssets } from './storage';
import { serviceClient } from './supabase';

/**
 * Right to erasure (§9, DPDP §12) — a real deletion, not an anonymization.
 *
 * Deleting the parent's `auth.users` row cascades away profiles → heroes →
 * books → pages, guides, events, feedback, share links, revisions, character
 * sheets and asset rows. Verified against Postgres 16 with migration 0005
 * applied; that migration also stops the cascade from taking `orders` with it.
 *
 * Orders and payments deliberately SURVIVE, de-linked (`parent_id`/`book_id`
 * null): tax retention needs the transaction, not the person. The Razorpay
 * payload stored on `payments.raw_webhook` carries the payer's email and phone,
 * so it is scrubbed here — otherwise "erasure" would leave PII behind in it.
 *
 * Ordering is load-bearing: storage objects go BEFORE the rows that index them,
 * because those rows hold the only copy of each storage key. Every step throws
 * on failure so a half-erasure is retried rather than reported as success.
 */
export async function eraseParentData(parentId: string): Promise<void> {
  const db = serviceClient();

  const { data: heroes, error: heroErr } = await db.from('heroes').select('id').eq('parent_id', parentId);
  if (heroErr) throw new Error(`Erasure failed reading heroes: ${heroErr.message}`);
  const heroIds = (heroes ?? []).map((h) => (h as { id: string }).id);

  const { data: books, error: bookErr } = await db.from('books').select('id').eq('parent_id', parentId);
  if (bookErr) throw new Error(`Erasure failed reading books: ${bookErr.message}`);
  const bookIds = (books ?? []).map((b) => (b as { id: string }).id);

  // 1. Gather every storage key BEFORE anything is deleted. Two sources: the
  // assets table, and the character sheets, whose reference images (the child's
  // face) are keyed inside a jsonb pack rather than in `assets`.
  const keys: string[] = [];
  if (bookIds.length || heroIds.length) {
    const orFilter = [
      bookIds.length ? `book_id.in.(${bookIds.join(',')})` : '',
      heroIds.length ? `hero_id.in.(${heroIds.join(',')})` : '',
    ]
      .filter(Boolean)
      .join(',');
    const { data: assets, error } = await db.from('assets').select('storage_key').or(orFilter);
    if (error) throw new Error(`Erasure failed reading assets: ${error.message}`);
    keys.push(...((assets ?? []) as { storage_key: string }[]).map((a) => a.storage_key));
  }
  if (heroIds.length) {
    const { data: sheets, error } = await db
      .from('character_sheets')
      .select('reference_pack')
      .in('hero_id', heroIds);
    if (error) throw new Error(`Erasure failed reading character sheets: ${error.message}`);
    keys.push(...extractReferenceKeys(sheets ?? []));
  }

  // 2. Purge the objects. Throws — see the note on ordering above.
  await removeAssets(keys);

  // 3. Scrub the payer's contact details out of the retained webhook payloads.
  const { data: orders, error: orderErr } = await db.from('orders').select('id').eq('parent_id', parentId);
  if (orderErr) throw new Error(`Erasure failed reading orders: ${orderErr.message}`);
  const orderIds = (orders ?? []).map((o) => (o as { id: string }).id);
  if (orderIds.length) {
    const { error } = await db
      .from('payments')
      .update({ raw_webhook: { erased: true, erasedAt: new Date().toISOString() } })
      .in('order_id', orderIds);
    if (error) throw new Error(`Erasure failed scrubbing payment payloads: ${error.message}`);
  }

  // 4. Audit BEFORE the delete: audit_log has no FK to the parent, so it
  // survives, but the id must be recorded while we still know it.
  await audit({
    actor: 'system',
    action: 'account.erased',
    entity: 'profiles',
    entityId: parentId,
    metadata: { heroes: heroIds.length, books: bookIds.length, storageObjects: keys.length, ordersRetained: orderIds.length },
  });

  // 5. Delete the account itself. This is what makes the parent's email go away
  // and their session stop working; everything else cascades from it.
  const { error: delErr } = await db.auth.admin.deleteUser(parentId);
  if (delErr) throw new Error(`Erasure failed deleting the account: ${delErr.message}`);
}

function extractReferenceKeys(rows: unknown[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    const pack = (row as { reference_pack?: unknown }).reference_pack;
    const images = (pack as { images?: unknown[] } | null | undefined)?.images;
    if (!Array.isArray(images)) continue;
    for (const image of images) {
      const storageKey = (image as { storageKey?: unknown }).storageKey;
      if (typeof storageKey === 'string' && storageKey) keys.push(storageKey);
    }
  }
  return keys;
}
