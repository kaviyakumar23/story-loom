import { loadEnv } from '../config/env';
import { audit } from '../lib/audit';
import { sendPreviewWinback } from '../lib/email';
import { canSendMarketing, unsubscribeUrl } from '../lib/marketing';
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

    let sent = 0;
    for (const b of targets) {
      // step.run memoizes its return, so accumulate OUTSIDE the step — mutating a
      // closure variable would reset to 0 on Inngest replay.
      const didSend = await step.run(`winback-${b.id}`, async () => {
        const db = serviceClient();
        const { data: u } = await db.auth.admin.getUserById(b.parent_id);
        const email = u.user?.email;
        // Still anonymous (no email): do NOT consume the one-shot — leave the book
        // eligible so it can be won back if the parent adds an email in-window.
        if (!email) return false;
        // Promotional email needs marketing consent (§7). No consent → mark sent
        // so we stop re-checking daily, but never email.
        if (!(await canSendMarketing(b.parent_id))) {
          await db.from('books').update({ winback_sent_at: new Date().toISOString() }).eq('id', b.id);
          return false;
        }
        // Claim the one-shot, THEN send — a lost send beats a double-send.
        await db.from('books').update({ winback_sent_at: new Date().toISOString() }).eq('id', b.id);
        try {
          await sendPreviewWinback(email, `${env.APP_BASE_URL}/books/${b.id}`, unsubscribeUrl(b.parent_id));
          await audit({ actor: 'system', action: 'preview.winback', entity: 'books', entityId: b.id });
          return true;
        } catch {
          // best-effort; the one-shot flag is already set
          return false;
        }
      });
      if (didSend) sent += 1;
    }
    return { scanned: targets.length, sent };
  },
);
