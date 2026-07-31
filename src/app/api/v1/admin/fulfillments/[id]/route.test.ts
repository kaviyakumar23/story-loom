import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  shipped: 0,
  orderStatus: 'paid',
  release: { released: true, reason: null } as { released: boolean; reason: string | null },
  masterSha: 'a'.repeat(64),
}));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ APP_BASE_URL: 'https://m' }) }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/audit', () => ({ audit: async () => {} }));
vi.mock('@/server/lib/email', () => ({ sendShipped: async () => { h.shipped += 1; } }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { PATCH, POST } from './route';

const ctx = { params: Promise.resolve({ id: 'f1' }) };
const patch = (body: unknown) => PATCH(new Request('https://m/api/v1/admin/fulfillments/f1', { method: 'PATCH', body: JSON.stringify(body) }), ctx);

/** A fulfillment currently in `status`, with an updated row + book owner ready. */
function fDb(status: string, tracking: string | null = null) {
  return makeSupabase({
    userEmail: 'parent@example.com',
    tables: {
      fulfillments: (op) => (op === 'select'
        ? { data: { id: 'f1', status, tracking_number: tracking, carrier: null, book_id: 'b1', order_id: 'o1', print_master_key: 'books/b1/print/interior.pdf' } }
        : { data: { id: 'f1', status: 'shipped' } }),
      orders: { data: { status: h.orderStatus } },
      books: { data: { parent_id: 'p1' } },
      order_events: { data: null },
      assets: { data: { sha256: h.masterSha, storage_key: 'books/b1/print/interior.pdf' } },
    },
    rpc: { release_to_print: () => ({ data: h.release }) },
  });
}

const release = (body: unknown) =>
  POST(new Request('https://m/api/v1/admin/fulfillments/f1', { method: 'POST', body: JSON.stringify(body) }), ctx);

describe('PATCH /admin/fulfillments/:id (integration)', () => {
  beforeEach(() => {
    h.shipped = 0; h.orderStatus = 'paid';
    h.release = { released: true, reason: null }; h.masterSha = 'a'.repeat(64);
  });

  // QC is now a state someone must clear. A paid book used to land in the print
  // queue already marked ready, which for a physical object sent to a child is
  // the wrong default.
  it('passes QC from qc_pending to print_ready and records it', async () => {
    h.db = fDb('qc_pending');
    const res = await patch({ status: 'print_ready', qcNotes: 'Spelling and spread checked.' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'fulfillments', 'update')?.values).toMatchObject({ status: 'print_ready' });
    expect(findOp(h.db!, 'order_events', 'insert')?.values).toMatchObject({ type: 'qc_pass' });
  });

  it('holds a book that fails QC', async () => {
    h.db = fDb('qc_pending');
    const res = await patch({ status: 'qc_hold', qcNotes: 'Page 7 crops the hero.' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'order_events', 'insert')?.values).toMatchObject({ type: 'qc_hold' });
  });

  // Releasing is not a status change but a commitment — from there the file
  // exists as an object nothing can recall — so it does not go through PATCH.
  it('refuses to reach printing through the status machine', async () => {
    h.db = fDb('print_ready');
    const res = await patch({ status: 'printing' } as never);
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'fulfillments', 'update')).toBeUndefined();
  });

  it('refuses an illegal transition (print_ready → shipped)', async () => {
    h.db = fDb('print_ready');
    const res = await patch({ status: 'shipped', trackingNumber: 'TRK1' });
    expect(res.status).toBe(400);
    expect(findOp(h.db!, 'fulfillments', 'update')).toBeUndefined();
  });

  // The machine never looked at the order, so a refunded book could be walked
  // all the way to shipped.
  it('refuses to advance a refunded order', async () => {
    h.orderStatus = 'refunded';
    h.db = fDb('qc_pending');
    const res = await patch({ status: 'print_ready' });
    expect(res.status).toBe(409);
    expect(findOp(h.db!, 'fulfillments', 'update')).toBeUndefined();
  });
});

describe('POST /admin/fulfillments/:id — release to print', () => {
  beforeEach(() => {
    h.orderStatus = 'paid'; h.release = { released: true, reason: null }; h.masterSha = 'a'.repeat(64);
  });

  it('releases through the atomic function and records who did it', async () => {
    h.db = fDb('print_ready');
    const res = await release({ sha256: 'a'.repeat(64), reviewer: 'kaviya' });
    expect(res.status).toBe(200);
    expect(h.db!.rpcCalls[0][0]).toBe('release_to_print');
    expect(h.db!.rpcCalls[0][1]).toMatchObject({ p_reviewer: 'kaviya' });
  });

  // Approving one file and sending another is the failure this exists to stop.
  it('refuses a hash that is not the master on record', async () => {
    h.db = fDb('print_ready');
    const res = await release({ sha256: 'b'.repeat(64), reviewer: 'kaviya' });
    expect(res.status).toBe(409);
    expect(h.db!.rpcCalls).toHaveLength(0);
  });

  it('surfaces the reason when the transaction refuses (refunded mid-release)', async () => {
    h.release = { released: false, reason: 'order_not_paid' };
    h.db = fDb('print_ready');
    const res = await release({ sha256: 'a'.repeat(64), reviewer: 'kaviya' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toMatch(/not paid|refunded/i);
  });

  it('requires a tracking number to mark shipped', async () => {
    h.db = fDb('printing');
    const res = await patch({ status: 'shipped' });
    expect(res.status).toBe(400);
  });

  it('marks shipped with tracking and emails the parent', async () => {
    h.db = fDb('printing');
    const res = await patch({ status: 'shipped', trackingNumber: 'TRK1', carrier: 'BlueDart' });
    expect(res.status).toBe(200);
    expect(findOp(h.db!, 'fulfillments', 'update')?.values).toMatchObject({ status: 'shipped', tracking_number: 'TRK1' });
    expect(h.shipped).toBe(1);
  });
});
