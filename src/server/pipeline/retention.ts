import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { removeAssets } from '../lib/storage';
import { serviceClient } from '../lib/supabase';
import { inngest } from './client';

/**
 * Retention purge cron (§11). Unpurchased previews cost storage and hold child
 * data we no longer need — purge them (objects + rows) after the retention
 * window. Purchased books are kept for the parent. Runs daily.
 *
 * Deleting the book row cascades its pages, assets, and generation_events
 * (FKs are ON DELETE CASCADE).
 *
 * A hero left with no books is then purged too, character sheet and reference
 * images included. Keeping the sheet "in case they come back" sounds thrifty,
 * but it means a child's nickname, age band, attributes and face outlive every
 * book they appeared in, with no retention limit at all — which is the opposite
 * of what this job exists to do. A returning parent regenerates it for pennies.
 */
export const retentionPurge = inngest.createFunction(
  { id: 'retention-purge', name: 'Purge unpurchased previews', triggers: [{ cron: '17 3 * * *' }] },
  async ({ step }) => {
    const days = loadEnv().PREVIEW_RETENTION_DAYS;

    const expired = await step.run('find-expired', async () => {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await serviceClient()
        .from('books')
        .select('id, hero_id')
        .is('purchased_tier', null)
        .lt('created_at', cutoff)
        .limit(500);
      return (data ?? []) as { id: string; hero_id: string }[];
    });

    if (!expired.length) return { purged: 0, heroesPurged: 0 };
    const bookIds = expired.map((b) => b.id);

    await step.run('purge-books', async () => {
      const db = serviceClient();
      const { data: assets } = await db
        .from('assets')
        .select('storage_key')
        .in('book_id', bookIds);
      // Objects before rows: the rows are the only index of these keys.
      await removeAssets(((assets ?? []) as { storage_key: string }[]).map((a) => a.storage_key));
      const { error } = await db.from('books').delete().in('id', bookIds);
      if (error) throw new Error(`Retention purge failed deleting books: ${error.message}`);
    });

    const heroesPurged = await step.run('purge-orphaned-heroes', async () => {
      const db = serviceClient();
      const candidates = [...new Set(expired.map((b) => b.hero_id))];
      if (!candidates.length) return 0;

      // Which of these heroes still star in a book? Those stay.
      const { data: stillUsed } = await db.from('books').select('hero_id').in('hero_id', candidates);
      const keep = new Set(((stillUsed ?? []) as { hero_id: string }[]).map((b) => b.hero_id));
      const orphans = candidates.filter((id) => !keep.has(id));
      if (!orphans.length) return 0;

      const { data: sheets } = await db
        .from('character_sheets')
        .select('reference_pack')
        .in('hero_id', orphans);
      const { data: heroAssets } = await db.from('assets').select('storage_key').in('hero_id', orphans);
      await removeAssets([
        ...extractReferenceKeys(sheets ?? []),
        ...((heroAssets ?? []) as { storage_key: string }[]).map((a) => a.storage_key),
      ]);

      // character_sheets and assets cascade from heroes.
      const { error } = await db.from('heroes').delete().in('id', orphans);
      if (error) throw new Error(`Retention purge failed deleting heroes: ${error.message}`);
      return orphans.length;
    });

    await step.run('audit', async () =>
      audit({
        actor: 'system',
        action: 'retention.purged',
        entity: 'books',
        entityId: bookIds[0] ?? 'batch',
        metadata: { count: bookIds.length, heroesPurged, retentionDays: days },
      }),
    );

    return { purged: bookIds.length, heroesPurged };
  },
);

/** Reference images live keyed inside the sheet's jsonb pack, not in `assets`. */
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
