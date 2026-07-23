import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  imgAllowed: true,
  includesAudio: false,
  assembleCalls: 0,
  audioCalls: 0,
  uploaded: [] as string[],
}));

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('../config/env', () => ({ loadEnv: () => ({ MAX_IMAGE_ATTEMPTS: 2 }) }));
vi.mock('../config/pricing', () => ({ priceFor: () => ({ includesAudio: h.includesAudio, physical: true }) }));
vi.mock('../lib/cost', () => ({ recordEvent: async () => {}, imageCost: () => 0 }));
vi.mock('../lib/observability', () => ({ captureError: () => {} }));
vi.mock('../lib/storage', () => ({ uploadAsset: async (k: string) => { h.uploaded.push(k); } }));
vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('./fulfillment', () => ({
  assemble: async () => { h.assembleCalls += 1; },
  synthesizeAudio: async () => { h.audioCalls += 1; },
}));
vi.mock('./helpers', () => ({
  loadContext: async () => ({ bookId: 'book-1', heroId: 'hero-1', nickname: 'Aarav', imageModel: 'i', purchasedTier: 'print' }),
  resolveCharacterSheet: async () => ({ images: [], palette: ['warm'], clothingTokens: [], negativeConstraints: ['no text'] }),
}));
vi.mock('../providers/index', () => ({
  getProviders: () => ({
    image: { renderPage: async () => ({ value: { base64: 'img', mime: 'image/png' }, usage: { model: 'm' } }) },
    moderator: { moderateImage: async () => ({ allowed: h.imgAllowed, reasons: h.imgAllowed ? [] : ['unsafe'] }) },
  }),
}));

import { applyBookEdit } from './edit';

const run = (mode: 'text' | 'image') =>
  handlerOf(applyBookEdit)({ event: { data: { bookId: 'book-1', pageIndex: 0, mode, instruction: null } }, step: makeStep() });

describe('applyBookEdit (orchestration)', () => {
  beforeEach(() => {
    h.imgAllowed = true; h.includesAudio = false; h.assembleCalls = 0; h.audioCalls = 0; h.uploaded = [];
    h.db = makeSupabase({
      tables: {
        book_pages: (op) => (op === 'select' ? { data: { illustration_prompt: 'a scene' } } : { data: null }),
        assets: { data: { id: 'asset-new' } },
        books: (op) => (op === 'select' ? { data: { render_credits: 2 } } : { data: null }),
      },
    });
  });

  it('text edit → rebuilds the PDF and clears the editing flag (no audio on a non-audio tier)', async () => {
    const out = (await run('text')) as { changed: boolean };
    expect(out.changed).toBe(true);
    expect(h.assembleCalls).toBe(1);
    expect(h.audioCalls).toBe(0);
    expect(findOp(h.db!, 'books', 'update')?.values).toMatchObject({ editing_at: null });
  });

  it('text edit on an audio tier also re-synthesizes narration', async () => {
    h.includesAudio = true;
    await run('text');
    expect(h.assembleCalls).toBe(1);
    expect(h.audioCalls).toBe(1);
  });

  it('image regen success → re-renders the page then rebuilds the PDF', async () => {
    const out = (await run('image')) as { changed: boolean };
    expect(out.changed).toBe(true);
    expect(h.uploaded).toContain('books/book-1/pages/0.png'); // page re-rendered
    expect(h.assembleCalls).toBe(1);
  });

  it('image regen blocked → keeps old image, refunds the credit, does NOT rebuild', async () => {
    h.imgAllowed = false;
    const out = (await run('image')) as { changed: boolean };
    expect(out.changed).toBe(false);
    expect(h.uploaded).toHaveLength(0); // never stored a blocked image
    expect(h.assembleCalls).toBe(0); // nothing changed → no rebuild
    // A books update happened to refund the credit (2 → 3).
    expect(findOp(h.db!, 'books', 'update')?.values).toMatchObject({ render_credits: 3 });
  });
});
