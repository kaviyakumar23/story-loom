import { audit } from './audit';
import { removeAssets } from './storage';
import { serviceClient } from './supabase';

/**
 * Right-to-erasure workflow (§9). DPDP requires we purge child/hero data on
 * request. We ANONYMIZE rather than hard-delete rows that financial/audit
 * records depend on (orders, payments) — erasing the personal data while
 * preserving the transaction trail.
 *
 * Phase 1 runs this inline. At volume, move it behind a durable job so storage
 * purges and retries are observable.
 */
export async function eraseParentData(parentId: string): Promise<void> {
  const db = serviceClient();

  const { data: heroes } = await db.from('heroes').select('id').eq('parent_id', parentId);
  const heroIds = (heroes ?? []).map((h) => (h as { id: string }).id);

  const { data: books } = await db.from('books').select('id').eq('parent_id', parentId);
  const bookIds = (books ?? []).map((b) => (b as { id: string }).id);

  // Strip child-identifying free text from story content.
  if (bookIds.length) {
    await db
      .from('book_pages')
      .update({ text: '[erased]', illustration_prompt: null })
      .in('book_id', bookIds);
    await db.from('books').update({ title: null, theme: null }).in('id', bookIds);
  }

  // Anonymize the hero records (nickname, attributes, interests).
  if (heroIds.length) {
    await db
      .from('heroes')
      .update({ nickname: '[erased]', avatar: {}, interests: [] })
      .in('id', heroIds);
  }

  // Remove generated assets — both the underlying storage objects and the rows.
  if (bookIds.length || heroIds.length) {
    const orFilter = [
      bookIds.length ? `book_id.in.(${bookIds.join(',')})` : '',
      heroIds.length ? `hero_id.in.(${heroIds.join(',')})` : '',
    ]
      .filter(Boolean)
      .join(',');
    const { data: assets } = await db.from('assets').select('storage_key').or(orFilter);
    await removeAssets(((assets ?? []) as { storage_key: string }[]).map((a) => a.storage_key));
    await db.from('assets').delete().or(orFilter);
  }

  await db.from('profiles').update({ display_name: null }).eq('id', parentId);

  await audit({
    actor: 'system',
    action: 'account.erased',
    entity: 'profiles',
    entityId: parentId,
    metadata: { heroes: heroIds.length, books: bookIds.length },
  });
}
