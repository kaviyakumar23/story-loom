import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { sendPreviewWinback } from '../lib/email';
import { serviceClient } from '../lib/supabase';
import { inngest } from './client';

/**
 * Win-back cron. A parent who made a free preview but never bought is a
 * recoverable customer — email them once, a couple of days in, while the
 * preview still exists (the retention purge deletes it at PREVIEW_RETENTION_DAYS,
 * so we fire well inside that window). `winback_sent_at` makes it one-shot.
 */
const WINBACK_AFTER_DAYS = 2;

export const previewWinback = inngest.createFunction(
  { id: 'preview-winback', name: 'Win back unpurchased previews', triggers: [{ cron: '32 12 * * *' }] },
  async ({ step }) => {
    const env = loadEnv();
    const now = Date.now();
    const olderThan = new Date(now - WINBACK_AFTER_DAYS * 86_400_000).toISOString();
    // Leave a 2-day buffer so we never email a preview that's about to be purged.
    const notBefore = new Date(now - (env.PREVIEW_RETENTION_DAYS - 2) * 86_400_000).toISOString();

    const targets = await step.run('find-targets', async () => {
      const { data } = await serviceClient()
        .from('books')
        .select('id, parent_id')
        .eq('status', 'preview_ready')
        .is('purchased_tier', null)
        .is('winback_sent_at', null)
        .lt('created_at', olderThan)
        .gt('created_at', notBefore)
        .limit(100);
      return (data ?? []) as { id: string; parent_id: string }[];
    });

    for (const b of targets) {
      await step.run(`winback-${b.id}`, async () => {
        const db = serviceClient();
        // Mark sent first (idempotent one-shot) — even if the parent is still
        // anonymous with no email, we never reconsider this book.
        await db.from('books').update({ winback_sent_at: new Date().toISOString() }).eq('id', b.id);
        const { data: u } = await db.auth.admin.getUserById(b.parent_id);
        const email = u.user?.email;
        if (email) {
          try {
            await sendPreviewWinback(email, `${env.APP_BASE_URL}/books/${b.id}`);
            await audit({ actor: 'system', action: 'preview.winback', entity: 'books', entityId: b.id });
          } catch {
            // best-effort; the one-shot flag is already set
          }
        }
      });
    }
    return { processed: targets.length };
  },
);
