import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  includesAudio: false,
  physical: true,
  renders: 0,
  audioSynths: 0,
  uploaded: [] as string[],
  printReady: 0,
  bookReady: 0,
  booksSelect: 0,
  ordersSelect: 0,
}));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('../config/env', () => ({ loadEnv: () => ({ APP_BASE_URL: 'https://m' }) }));
vi.mock('../config/pricing', () => ({ priceFor: () => ({ includesAudio: h.includesAudio, physical: h.physical }) }));
vi.mock('../lib/cost', () => ({ recordEvent: async () => {}, imageCost: () => 0 }));
vi.mock('../lib/observability', () => ({ captureError: () => {} }));
vi.mock('../lib/audit', () => ({ audit: async () => {} }));
vi.mock('../lib/pdf', () => ({ assemblePdf: async () => Buffer.from('%PDF') }));
vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('../lib/storage', () => ({ downloadAsset: async () => Buffer.from('img'), uploadAsset: async (k: string) => { h.uploaded.push(k); } }));
vi.mock('../lib/email', () => ({
  sendPrintReady: async () => { h.printReady += 1; },
  sendBookReady: async () => { h.bookReady += 1; },
  sendAdminAlert: async () => {},
}));
vi.mock('../providers/index', () => ({ getProviders: () => ({ audio: { synthesize: async () => { h.audioSynths += 1; return { buffer: Buffer.from(''), mime: 'audio/mpeg', usage: { model: 'x' } }; } } }) }));
vi.mock('./helpers', () => ({
  buildScript: async () => 'script',
  loadContext: async () => ({ bookId: 'book-1', parentId: 'p1', nickname: 'Aarav', purchasedTier: 'print', imageModel: 'i' }),
  resolveCharacterSheet: async () => ({ images: [], palette: [], clothingTokens: [], negativeConstraints: [] }),
  renderAndStorePage: async () => { h.renders += 1; return { model: 'm', attempts: 1 }; },
  setProgress: async () => {},
  markFailed: async () => {},
}));

import { fulfillmentPipeline } from './fulfillment';

const run = () => handlerOf(fulfillmentPipeline)({ event: { data: { bookId: 'book-1' } }, step: makeStep() });

function baseDb(bookStatus = 'paid') {
  return makeSupabase({
    userEmail: 'parent@example.com',
    tables: {
      book_pages: (_op, ctx) => (ctx.filters.some((f) => f.m === 'is' && f.args[0] === 'image_asset_id')
        ? { data: [{ page_index: 5, illustration_prompt: 'p5', image_asset_id: null }] } // one page still to render
        : { data: [{ page_index: 0, text: 't', image_asset_id: 'img0' }] }), // assemble's full list
      books: (op) => {
        if (op === 'update') return { data: null };
        h.booksSelect += 1;
        return h.booksSelect === 1
          ? { data: { title: 'T', cover_asset_id: 'cover', series_number: 1 } } // assemble
          : { data: { status: bookStatus } }; // deliver's dedupe check
      },
      assets: (op) => (op === 'select' ? { data: [{ id: 'cover', storage_key: 'kc' }, { id: 'img0', storage_key: 'k0' }] } : { data: null }),
      orders: () => { h.ordersSelect += 1; return h.ordersSelect === 1 ? { data: { gift_message: null, is_gift: false } } : { data: { id: 'o1' } }; },
      shipping_addresses: { data: { id: 'addr1' } },
      fulfillments: { data: null },
    },
  });
}

describe('fulfillmentPipeline (orchestration)', () => {
  beforeEach(() => {
    h.includesAudio = false; h.physical = true; h.renders = 0; h.audioSynths = 0;
    h.uploaded = []; h.printReady = 0; h.bookReady = 0; h.booksSelect = 0; h.ordersSelect = 0;
  });

  it('renders remaining pages, assembles the PDF, and delivers a physical order', async () => {
    h.db = baseDb('paid');
    const out = (await run()) as { status: string };
    expect(out.status).toBe('complete');
    expect(h.renders).toBe(1); // the one pending page
    expect(h.uploaded).toContain('books/book-1/book.pdf'); // assembled + stored
    expect(findOp(h.db!, 'books', 'update')?.values).toMatchObject({ status: 'complete' });
    expect(h.printReady).toBe(1); // physical → print-ready email
    expect(h.bookReady).toBe(0);
    expect(h.audioSynths).toBe(0); // tier has no audio
  });

  it('synthesizes audio only when the tier includes it', async () => {
    h.includesAudio = true;
    h.db = baseDb('paid');
    await run();
    expect(h.audioSynths).toBe(1);
  });

  it('does not re-deliver (or re-email) a book already complete', async () => {
    h.db = baseDb('complete'); // deliver sees it already complete → early return
    await run();
    expect(h.printReady).toBe(0);
    expect(h.bookReady).toBe(0);
  });
});
