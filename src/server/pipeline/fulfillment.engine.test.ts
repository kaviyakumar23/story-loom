import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null, uploaded: [] as string[], assembled: 0 }));

vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('../lib/audit', () => ({ audit: async () => {} }));
vi.mock('../lib/cost', () => ({ recordEvent: async () => {}, imageCost: () => 0 }));
vi.mock('../lib/storage', () => ({
  downloadAsset: async () => Buffer.from('image-bytes'),
  uploadAsset: async (key: string) => { h.uploaded.push(key); },
}));
vi.mock('../lib/pdf', () => ({ assemblePdf: async () => { h.assembled += 1; return Buffer.from('%PDF-1.7'); } }));

import { assemble } from './fulfillment';
import type { BookContext } from './helpers';

const ctx = { bookId: 'book-1', nickname: 'Aarav', imageModel: 'i' } as BookContext;

describe('assemble (engine — never ship a text-only PDF)', () => {
  beforeEach(() => { h.uploaded = []; h.assembled = 0; });

  it('builds and stores the PDF when every image is present', async () => {
    h.db = makeSupabase({
      tables: {
        books: { data: { title: 'T', cover_asset_id: 'cover', series_number: 1 } },
        book_pages: { data: [{ page_index: 0, text: 'p0', image_asset_id: 'img0' }] },
        assets: { data: [{ id: 'cover', storage_key: 'k-cover' }, { id: 'img0', storage_key: 'k-0' }] },
        orders: { data: { gift_message: null, is_gift: false } },
      },
    });
    await assemble(ctx);
    expect(h.assembled).toBe(1);
    expect(h.uploaded).toContain('books/book-1/book.pdf');
  });

  it('throws (rather than shipping a text-only book) when a page image is missing', async () => {
    h.db = makeSupabase({
      tables: {
        books: { data: { title: 'T', cover_asset_id: 'cover', series_number: 1 } },
        book_pages: { data: [{ page_index: 0, text: 'p0', image_asset_id: 'img0' }] },
        assets: { data: [{ id: 'cover', storage_key: 'k-cover' }] }, // img0 missing
        orders: { data: null },
      },
    });
    await expect(assemble(ctx)).rejects.toThrow(/illustration/i);
    expect(h.assembled).toBe(0);
    expect(h.uploaded).toHaveLength(0);
  });
});
