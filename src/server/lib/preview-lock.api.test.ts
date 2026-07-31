import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockDb } from '@/server/test/supabase-mock';

/**
 * Evidence for the beta's locked-preview rule: a free preview is the cover plus
 * the first few illustrated pages, and the API must not hand out the rest.
 *
 * The whole story text exists in the database from preview_ready (one model call
 * writes every page), so "locked" is a serialisation decision. If it regressed,
 * nothing would look broken — the product would just be free. Hence these tests.
 */
const h = vi.hoisted(() => ({ db: null as MockDb | null, digital: 'false' }));

vi.mock('@/server/lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('@/server/lib/storage', () => ({ signAsset: async (key: string) => `https://signed.example/${key}` }));
vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ DIGITAL_COMPANION_ENABLED: h.digital }) }));

import { toBook, type BookRow } from '@/server/lib/mappers';

const PREVIEW_PAGES = [
  { page_index: 0, text: 'Page one.', image_asset_id: 'img-0' },
  { page_index: 1, text: 'Page two.', image_asset_id: 'img-1' },
  { page_index: 2, text: 'Page three.', image_asset_id: 'img-2' },
];
const LOCKED_TEXT = 'The secret ending nobody has paid for yet.';
const ALL_PAGES = [...PREVIEW_PAGES, ...Array.from({ length: 9 }, (_, i) => ({ page_index: i + 3, text: LOCKED_TEXT, image_asset_id: null }))];

function row(over: Partial<BookRow> = {}): BookRow {
  return {
    id: 'b1', status: 'preview_ready', progress: 100, goal: 'reading_confidence', occasion_pack: null,
    language: 'en', reading_level: 'early', title: 'A Story', theme: 'courage', purchased_tier: null,
    cover_asset_id: 'cover-1', error: null, created_at: '2026-07-01', updated_at: '2026-07-01',
    render_credits: 0, editing_at: null, ...over,
  } as BookRow;
}

/** Answers page reads honestly: the `is_preview` filter decides what comes back. */
function db(opts: { pdf?: boolean } = {}) {
  return makeSupabase({
    tables: {
      book_revision_requests: (_op, c) => (c.head ? { count: 0 } : { data: null }),
      book_reading_guides: { data: { vocabulary: ['brave'], discussion_questions: ['q?'], activity: 'draw' } },
      fulfillments: { data: null },
      assets: (_op, c) => {
        if (c.filters.some((f) => f.m === 'eq' && f.args[0] === 'id')) return { data: { storage_key: 'assets/img.png' } };
        return { data: opts.pdf ? [{ type: 'pdf', storage_key: 'books/b1/book.pdf' }] : [] };
      },
      book_pages: (_op, c) => {
        if (c.head) return { count: ALL_PAGES.length };
        const previewOnly = c.filters.some((f) => f.m === 'eq' && f.args[0] === 'is_preview');
        return { data: previewOnly ? PREVIEW_PAGES : ALL_PAGES };
      },
    },
  });
}

describe('preview lock — unpaid readers never receive the locked pages', () => {
  beforeEach(() => { h.digital = 'false'; });

  it('serves cover + preview pages at preview_ready, and no story text beyond them', async () => {
    h.db = db();
    const book = await toBook(row(), { includeDelivery: true });

    expect(book.preview?.pages).toHaveLength(3);
    expect(book.coverUrl).toBe('https://signed.example/assets/img.png');
    expect(book.fullStory).toBeUndefined();
    expect(JSON.stringify(book)).not.toContain(LOCKED_TEXT);
  });

  it('reports the total page count so the lock can be honest about what is missing', async () => {
    h.db = db();
    const book = await toBook(row(), { includeDelivery: true });
    expect(book.pageCount).toBe(12);
    expect(book.pageCount! - book.preview!.pages.length).toBe(9);
  });

  it('keeps the story locked for a share-link viewer of a PAID book', async () => {
    h.db = db();
    // The share page maps without includeDelivery — being paid is the owner's
    // status, not the link holder's.
    const book = await toBook(row({ status: 'paid', purchased_tier: 'print' }));
    expect(book.fullStory).toBeUndefined();
    expect(book.pdfUrl).toBeUndefined();
    expect(JSON.stringify(book)).not.toContain(LOCKED_TEXT);
  });

  it('unlocks the whole book for the owner once paid', async () => {
    h.db = db();
    const book = await toBook(row({ status: 'complete', purchased_tier: 'print' }), { includeDelivery: true });
    expect(book.fullStory?.pages).toHaveLength(12);
    expect(book.readingGuide?.vocabulary).toContain('brave');
  });
});

describe('hardcover-only delivery', () => {
  beforeEach(() => { h.digital = 'false'; });

  it('does not sign the print master for a paid physical order', async () => {
    h.db = db({ pdf: true });
    const book = await toBook(row({ status: 'complete', purchased_tier: 'print' }), { includeDelivery: true });
    expect(book.pdfUrl).toBeNull();
  });

  it('still delivers a file for a non-physical tier', async () => {
    h.db = db({ pdf: true });
    const book = await toBook(row({ status: 'complete', purchased_tier: 'pdf' }), { includeDelivery: true });
    expect(book.pdfUrl).toBe('https://signed.example/books/b1/book.pdf');
  });

  it('hands over the digital copy again once the companion is switched back on', async () => {
    h.digital = 'true';
    h.db = db({ pdf: true });
    const book = await toBook(row({ status: 'complete', purchased_tier: 'print' }), { includeDelivery: true });
    expect(book.pdfUrl).toBe('https://signed.example/books/b1/book.pdf');
  });
});
