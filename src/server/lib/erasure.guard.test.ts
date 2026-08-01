import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * Evidence that erasure cannot cancel a paid order by accident.
 *
 * Deleting an account mid-fulfilment used to cascade away the fulfilment row and
 * the shipping address, and the storage sweep deleted the print master — so a
 * book someone had paid for silently vanished from the founder's queue with
 * nothing left to show it had ever existed. The parent's request is still
 * honoured; it just waits until the book is out of our hands.
 */
const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { findErasureBlock } from './erasure';

function db(opts: { paidOrders?: { id: string; status: string; book_id: string | null }[]; fulfillments?: { status: string }[] }) {
  return makeSupabase({
    tables: {
      orders: { data: opts.paidOrders ?? [] },
      fulfillments: { data: opts.fulfillments ?? [] },
    },
  });
}

describe('erasure guard', () => {
  beforeEach(() => { h.db = null; });

  it('allows erasure when there are no paid orders at all', async () => {
    h.db = db({ paidOrders: [] });
    expect(await findErasureBlock('p1')).toBeNull();
  });

  it('blocks while a printed order is still being made', async () => {
    h.db = db({ paidOrders: [{ id: 'o1', status: 'paid', book_id: 'b1' }], fulfillments: [{ status: 'printing' }] });
    const block = await findErasureBlock('p1');
    expect(block).not.toBeNull();
    expect(block?.reason).toMatch(/printing/);
    expect(block?.retryAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('blocks before print too — QC is part of the order, not a preamble', async () => {
    h.db = db({ paidOrders: [{ id: 'o1', status: 'paid', book_id: 'b1' }], fulfillments: [{ status: 'qc_pending' }] });
    expect(await findErasureBlock('p1')).not.toBeNull();
  });

  // Delivered or cancelled means the order is out of our hands, so waiting any
  // longer would just be us ignoring a deletion request.
  it('allows erasure once the order has reached a terminal state', async () => {
    h.db = db({ paidOrders: [{ id: 'o1', status: 'paid', book_id: 'b1' }], fulfillments: [] });
    expect(await findErasureBlock('p1')).toBeNull();
  });

  it('allows erasure for a paid order that never produced a fulfilment', async () => {
    h.db = db({ paidOrders: [{ id: 'o1', status: 'paid', book_id: null }] });
    expect(await findErasureBlock('p1')).toBeNull();
  });
});
