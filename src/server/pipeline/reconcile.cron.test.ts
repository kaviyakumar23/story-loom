import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, sends: [] as { name: string; data: { bookId: string } }[] }));

vi.mock('@/server/pipeline/client', () => ({
  inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }), send: async (e: { name: string; data: { bookId: string } }) => { h.sends.push(e); } },
  EVENTS: { fulfillmentRequested: 'book/fulfillment.requested' },
}));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/metrics', () => ({ evaluateAlerts: async () => {} }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { reconcilePaidBooks } from './reconcile';

describe('reconcilePaidBooks cron', () => {
  beforeEach(() => { h.sends = []; });

  it('re-enqueues fulfilment for a paid-but-stuck book (and leases it)', async () => {
    h.db = makeSupabase({ tables: { books: (op) => (op === 'select' ? { data: [{ id: 'stuck-1' }] } : { data: null }) } });
    const out = (await handlerOf(reconcilePaidBooks)({ step: makeStep() })) as { reEnqueued: number };
    expect(out.reEnqueued).toBe(1);
    expect(h.sends).toEqual([{ name: 'book/fulfillment.requested', data: expect.objectContaining({ bookId: 'stuck-1' }) }]);
  });

  it('does nothing when no books are stuck', async () => {
    h.db = makeSupabase({ tables: { books: { data: [] } } });
    const out = (await handlerOf(reconcilePaidBooks)({ step: makeStep() })) as { reEnqueued: number };
    expect(out.reEnqueued).toBe(0);
    expect(h.sends).toHaveLength(0);
  });
});
