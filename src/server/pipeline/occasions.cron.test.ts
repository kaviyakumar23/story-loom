import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  consent: true,
  claimError: null as { code: string } | null,
  nudges: [] as { to: string; opts: { heroName: string; occasion: string; url: string } }[],
}));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_cfg: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ APP_BASE_URL: 'https://m' }) }));
vi.mock('@/server/config/occasions', () => ({
  dueOccasions: () => [{ key: 'diwali-2026', label: 'Diwali', year: 2026, month: 11, day: 8, pack: null, leadDays: 21 }],
}));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/marketing', () => ({ canSendMarketing: async () => h.consent, unsubscribeUrl: () => 'https://m/unsub' }));
vi.mock('@/server/lib/email', () => ({ sendOccasionNudge: async (to: string, opts: typeof h.nudges[number]['opts']) => { h.nudges.push({ to, opts }); } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { occasionNudges } from './occasions';

/** One buyer with one hero (no birthday, no sibling) so only the calendar occasion fires. */
function buyerDb() {
  return makeSupabase({
    userEmail: 'buyer@example.com',
    tables: {
      books: (_op, ctx) => (ctx.filters.some((f) => f.m === 'eq' && f.args[0] === 'status')
        ? { data: [] } // sibling query (status='complete') → none
        : { data: [{ id: 'bk1', parent_id: 'par1', hero_id: 'h1', paid_at: '2026-06-01' }] }),
      heroes: { data: [{ id: 'h1', parent_id: 'par1', nickname: 'Mia', birth_month: null }] },
      occasion_nudges: () => (h.claimError ? { error: h.claimError } : { error: null }),
    },
  });
}

describe('occasionNudges cron', () => {
  beforeEach(() => { h.consent = true; h.claimError = null; h.nudges = []; });

  it('nudges a consented buyer for a due occasion, claiming the dedupe row first', async () => {
    h.db = buyerDb();
    const out = (await handlerOf(occasionNudges)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(1);
    expect(h.nudges).toHaveLength(1);
    expect(h.nudges[0]).toMatchObject({ to: 'buyer@example.com', opts: { heroName: 'Mia', occasion: 'Diwali' } });
    expect(h.nudges[0].opts.url).toContain('from=bk1');
    expect(findOp(h.db!, 'occasion_nudges', 'insert')?.values).toMatchObject({ parent_id: 'par1', hero_id: 'h1', occasion_key: 'diwali-2026' });
  });

  it('does NOT nudge a buyer who has not opted in to marketing', async () => {
    h.consent = false;
    h.db = buyerDb();
    const out = (await handlerOf(occasionNudges)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(0);
    expect(h.nudges).toHaveLength(0);
    // Consent is checked BEFORE claiming, so no dedupe row is even attempted.
    expect(findOp(h.db!, 'occasion_nudges', 'insert')).toBeUndefined();
  });

  it('is idempotent — a duplicate claim means it was already sent, so it does not resend', async () => {
    h.claimError = { code: '23505' };
    h.db = buyerDb();
    const out = (await handlerOf(occasionNudges)({ step: makeStep() })) as { sent: number };
    expect(out.sent).toBe(0);
    expect(h.nudges).toHaveLength(0);
  });
});
