import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { eraseParentData, findErasureBlock } from '../lib/erasure';
import { captureError } from '../lib/observability';
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

    // Hashed per-IP preview counters expire after 30 days (DPDP minimisation —
    // the abuse cap only ever needs today's row). Runs every day, so it sits
    // BEFORE the no-expired-previews early return.
    // A parent who asked to be deleted while a printed order was still in flight
    // is waiting on us, not the other way round. Their request is honoured as
    // soon as the book is out of our hands.
    const erased = await step.run('run-deferred-erasures', async () => runDeferredErasures());

    await step.run('purge-ip-usage', async () => {
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      await serviceClient().from('preview_ip_usage').delete().lt('day', cutoff);
    });

    if (!expired.length) return { purged: 0, heroesPurged: 0, erased };
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

    return { purged: bookIds.length, heroesPurged, erased };
  },
);

/**
 * Complete the erasures that had to wait for a printed order to finish.
 *
 * Re-checks the live state rather than trusting `deferred_until` — the estimate
 * is only there to stop us re-checking hourly, and an order can be delivered
 * early or cancelled outright.
 */
async function runDeferredErasures(): Promise<number> {
  const db = serviceClient();
  const { data } = await db
    .from('deletion_requests')
    .select('id, parent_id')
    .eq('status', 'deferred')
    .order('created_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []) as { id: string; parent_id: string }[];
  let done = 0;
  for (const row of rows) {
    const block = await findErasureBlock(row.parent_id);
    if (block) continue; // still in flight — leave it parked
    try {
      await eraseParentData(row.parent_id);
      await db.from('deletion_requests').update({ status: 'completed' }).eq('id', row.id);
      await audit({
        actor: 'system',
        action: 'account.erased_deferred',
        entity: 'deletion_requests',
        entityId: row.id,
      });
      done += 1;
    } catch (err) {
      // Leave it deferred and try again tomorrow: a half-finished erasure that
      // reports success is worse than one that visibly has not happened yet.
      captureError(err, { stage: 'deferred-erasure' });
    }
  }
  return done;
}

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
