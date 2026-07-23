import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  removedAssets: [] as string[][],
  removedPhotos: [] as string[][],
}));

vi.mock('./supabase', () => ({ serviceClient: () => h.db }));
vi.mock('./audit', () => ({ audit: async () => {} }));
vi.mock('./storage', () => ({ removeAssets: async (k: string[]) => { h.removedAssets.push(k); } }));
vi.mock('./photo-intake', () => ({ removePhotos: async (k: string[]) => { h.removedPhotos.push(k); } }));

import { eraseParentData } from './erasure';

describe('eraseParentData (DPDP erasure)', () => {
  beforeEach(() => { h.removedAssets = []; h.removedPhotos = []; });

  it('purges all storage (assets + sheet images + photos), scrubs payments, then deletes the account', async () => {
    h.db = makeSupabase({
      tables: {
        heroes: { data: [{ id: 'hero-1' }] },
        books: { data: [{ id: 'book-1' }] },
        assets: { data: [{ storage_key: 'books/book-1/cover.png' }] },
        character_sheets: { data: [{ reference_pack: { images: [{ storageKey: 'heroes/hero-1/sheet/turnaround.png' }] } }] },
        photo_uploads: { data: [{ storage_key: 'p1/pu1.jpg' }] },
        orders: { data: [{ id: 'order-1' }] },
        payments: { error: null },
      },
    });

    await eraseParentData('parent-1');

    // Assets bucket: both the asset row keys AND the sheet reference keys.
    expect(h.removedAssets[0]).toEqual(['books/book-1/cover.png', 'heroes/hero-1/sheet/turnaround.png']);
    // Separate photo-intake bucket.
    expect(h.removedPhotos[0]).toEqual(['p1/pu1.jpg']);
    // Retained order's webhook payload is scrubbed of payer PII.
    expect(findOp(h.db, 'payments', 'update')?.values).toMatchObject({ raw_webhook: expect.objectContaining({ erased: true }) });
    // The account itself is deleted last (everything else cascades from it).
    expect(h.db.authDeletes).toEqual(['parent-1']);
  });

  it('still deletes the account when the parent has no heroes/books/photos', async () => {
    h.db = makeSupabase({ tables: { heroes: { data: [] }, books: { data: [] }, orders: { data: [] }, photo_uploads: { data: [] } } });
    await eraseParentData('parent-2');
    expect(h.removedAssets[0] ?? []).toEqual([]);
    expect(h.db.authDeletes).toEqual(['parent-2']);
  });
});
