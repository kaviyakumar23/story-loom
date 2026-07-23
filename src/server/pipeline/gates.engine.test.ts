import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  textAllowed: true,
  imgAllowed: true,
  uploaded: [] as string[],
}));

vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ MAX_IMAGE_ATTEMPTS: 2 }) }));
vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('../lib/audit', () => ({ audit: async () => {} }));
vi.mock('../lib/cost', () => ({ recordEvent: async () => {}, imageCost: () => 0, textCost: () => 0 }));
vi.mock('../lib/storage', () => ({
  uploadAsset: async (key: string) => { h.uploaded.push(key); },
  downloadAsset: async () => Buffer.from('x'),
}));
vi.mock('../providers/index', () => ({
  resolveModelStamp: () => ({ modelTier: 'cost', textModel: 't', imageModel: 'i', promptVersion: 'v' }),
  getProviders: () => ({
    image: { renderPage: async () => ({ value: { base64: 'img', mime: 'image/png' }, usage: { model: 'gemini-image' } }) },
    moderator: {
      moderateText: async () => ({ allowed: h.textAllowed, reasons: h.textAllowed ? [] : ['hate'] }),
      moderateImage: async () => ({ allowed: h.imgAllowed, reasons: h.imgAllowed ? [] : ['unsafe'] }),
    },
  }),
}));

import { gateText, renderAndStorePage, type BookContext } from './helpers';

const ctx: BookContext = {
  bookId: 'book-1', parentId: 'p1', heroId: 'hero-1', nickname: 'Aarav', ageBand: '5-6',
  avatar: {}, interests: [], goal: 'reading_confidence', occasionPack: null, customTheme: null,
  readingLevel: 'early', purchasedTier: null, revisionInstruction: null, textModel: 't', imageModel: 'i',
};
const reference = { images: [{ view: 'turnaround', base64: 'r', mime: 'image/png' }], palette: ['warm'], clothingTokens: [], negativeConstraints: ['no text'] };

describe('moderation gates + page render (engine)', () => {
  beforeEach(() => { h.textAllowed = true; h.imgAllowed = true; h.uploaded = []; });

  it('gateText passes clean copy without touching the book', async () => {
    h.db = makeSupabase({});
    await expect(gateText('book-1', ['A kind story'])).resolves.toBeUndefined();
    expect(findOp(h.db, 'books', 'update')).toBeUndefined();
  });

  it('gateText fails CLOSED — marks the book failed and throws on blocked text', async () => {
    h.textAllowed = false;
    h.db = makeSupabase({ tables: { books: { data: null }, book_revision_requests: { data: null } } });
    await expect(gateText('book-1', ['bad'])).rejects.toThrow();
    expect(findOp(h.db, 'books', 'update')?.values).toMatchObject({ status: 'failed' });
  });

  it('renderAndStorePage stores an image and links it to the page on success', async () => {
    h.db = makeSupabase({ tables: { assets: { data: { id: 'asset-1' } } } });
    const out = await renderAndStorePage(ctx, 2, 'a scene', reference);
    expect(out).toMatchObject({ model: 'gemini-image', attempts: 1 });
    expect(h.uploaded[0]).toBe('books/book-1/pages/2.png');
    expect(findOp(h.db, 'book_pages', 'update')?.values).toMatchObject({ image_asset_id: 'asset-1' });
  });

  it('renderAndStorePage fails CLOSED after exhausting attempts on a blocked image', async () => {
    h.imgAllowed = false;
    h.db = makeSupabase({ tables: { assets: { data: { id: 'asset-1' } }, books: { data: null }, book_revision_requests: { data: null } } });
    await expect(renderAndStorePage(ctx, 2, 'a scene', reference)).rejects.toThrow();
    expect(h.uploaded).toHaveLength(0); // never stored a blocked image
    expect(findOp(h.db, 'books', 'update')?.values).toMatchObject({ status: 'failed' });
  });
});
