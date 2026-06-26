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
 * (FKs are ON DELETE CASCADE); the hero's character sheet is intentionally kept
 * (reusable for repeat purchases). Unpurchased books have no orders, so the
 * ON DELETE RESTRICT on orders.book_id never blocks this.
 */
export const retentionPurge = inngest.createFunction(
  { id: 'retention-purge', name: 'Purge unpurchased previews', triggers: [{ cron: '17 3 * * *' }] },
  async ({ step }) => {
    const days = loadEnv().PREVIEW_RETENTION_DAYS;

    const bookIds = await step.run('find-expired', async () => {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await serviceClient()
        .from('books')
        .select('id')
        .is('purchased_tier', null)
        .lt('created_at', cutoff)
        .limit(500);
      return ((data ?? []) as { id: string }[]).map((b) => b.id);
    });

    if (!bookIds.length) return { purged: 0 };

    await step.run('purge', async () => {
      const db = serviceClient();
      const { data: assets } = await db
        .from('assets')
        .select('storage_key')
        .in('book_id', bookIds);
      await removeAssets(((assets ?? []) as { storage_key: string }[]).map((a) => a.storage_key));
      await db.from('books').delete().in('id', bookIds);
      await audit({
        actor: 'system',
        action: 'retention.purged',
        entity: 'books',
        entityId: bookIds[0] ?? 'batch',
        metadata: { count: bookIds.length, retentionDays: days },
      });
    });

    return { purged: bookIds.length };
  },
);
