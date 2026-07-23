import { describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('@/server/auth', () => ({ requireAdmin: () => {} }));
vi.mock('@/server/lib/storage', () => ({ signAsset: async () => 'https://signed/master.pdf' }));
vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));

import { GET } from './route';

describe('GET /api/v1/admin/fulfillments (integration)', () => {
  it('returns the print queue with book/order/address joined and a signed master URL', async () => {
    h.db = makeSupabase({
      tables: {
        fulfillments: { data: [{ id: 'f1', book_id: 'b1', order_id: 'o1', address_id: 'a1', kind: 'print', status: 'print_ready', carrier: null, tracking_number: null, print_master_key: 'books/b1/book.pdf', printed_at: null, shipped_at: null, delivered_at: null, created_at: '2026-07-01', notes: null }] },
        books: { data: [{ id: 'b1', title: 'T', series_number: 2 }] },
        orders: { data: [{ id: 'o1', tier: 'print', amount: 99900, currency: 'INR' }] },
        shipping_addresses: { data: [{ id: 'a1', recipient_name: 'Grandma', city: 'Pune' }] },
      },
    });
    const res = await GET(new Request('https://m/api/v1/admin/fulfillments'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fulfillments: Array<{ book: { series_number: number }; order: { tier: string }; address: { recipient_name: string }; printMasterUrl: string }> };
    const f = body.fulfillments[0];
    expect(f.book.series_number).toBe(2);
    expect(f.order.tier).toBe('print');
    expect(f.address.recipient_name).toBe('Grandma');
    expect(f.printMasterUrl).toBe('https://signed/master.pdf');
  });
});
