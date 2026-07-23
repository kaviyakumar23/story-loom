import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, consent: true, sends: 0 }));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ PREVIEW_RETENTION_DAYS: 30, APP_BASE_URL: 'https://m' }) }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/marketing', () => ({ canSendMarketing: async () => h.consent, unsubscribeUrl: () => 'https://m/unsub' }));
vi.mock('@/server/lib/email', () => ({ sendPreviewWinback: async () => { h.sends += 1; } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { previewWinback } from './winback';

function db(email: string | null) {
  return makeSupabase({
    userEmail: email,
    tables: { books: (op) => (op === 'select' ? { data: [{ id: 'bk1', parent_id: 'par1' }] } : { data: null }) },
  });
}

describe('previewWinback cron', () => {
  beforeEach(() => { h.consent = true; h.sends = 0; });

  it('emails a consented parent and marks the one-shot flag', async () => {
    h.db = db('parent@example.com');
    const out = (await handlerOf(previewWinback)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(1);
    expect(h.sends).toBe(1);
    expect(findOp(h.db!, 'books', 'update')?.values).toHaveProperty('winback_sent_at');
  });

  it('does NOT consume the one-shot for an anonymous parent with no email', async () => {
    h.db = db(null);
    const out = (await handlerOf(previewWinback)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(0);
    expect(h.sends).toBe(0);
    expect(findOp(h.db!, 'books', 'update')).toBeUndefined(); // stays eligible
  });

  it('marks sent but does NOT email a parent without marketing consent', async () => {
    h.consent = false;
    h.db = db('parent@example.com');
    const out = (await handlerOf(previewWinback)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(0);
    expect(h.sends).toBe(0);
    expect(findOp(h.db!, 'books', 'update')?.values).toHaveProperty('winback_sent_at'); // stops re-checking
  });
});
