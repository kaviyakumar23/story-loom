import { listAllPhotoKeys, removePhotos } from '../lib/photo-intake';
import { serviceClient } from '../lib/supabase';
import { inngest } from './client';

/**
 * Hard 24h backstop on the ephemeral photo bucket. Photos are normally deleted
 * within minutes (as soon as the character sheet is generated), so anything this
 * cron finds is a leftover from a crash between upload and consume. Two sweeps:
 * by row (mark expired) and by listing the bucket directly (catches orphans with
 * no row). Nothing that survives a day is ever kept.
 */
const TTL_MS = 24 * 60 * 60_000;

export const photoIntakePurge = inngest.createFunction(
  { id: 'photo-intake-purge', name: 'Purge stale photo intake', triggers: [{ cron: '25 * * * *' }] },
  async ({ step }) => {
    const rows = await step.run('purge-rows', async () => {
      const db = serviceClient();
      const cutoff = new Date(Date.now() - TTL_MS).toISOString();
      const { data } = await db
        .from('photo_uploads')
        .select('id, storage_key')
        .is('deleted_at', null)
        .lt('created_at', cutoff)
        .limit(500);
      const list = (data ?? []) as { id: string; storage_key: string }[];
      if (!list.length) return 0;
      await removePhotos(list.map((r) => r.storage_key));
      const now = new Date().toISOString();
      await db.from('photo_uploads').update({ status: 'expired', deleted_at: now }).in('id', list.map((r) => r.id));
      return list.length;
    });

    const orphans = await step.run('purge-orphans', async () => {
      const all = await listAllPhotoKeys();
      const cutoff = Date.now() - TTL_MS;
      const stale = all.filter((o) => o.createdAt && Date.parse(o.createdAt) < cutoff).map((o) => o.key);
      if (!stale.length) return 0;
      await removePhotos(stale);
      return stale.length;
    });

    return { rows, orphans };
  },
);
