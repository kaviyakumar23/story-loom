import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

/** The character-sheet stage is the engine's cross-book consistency + safety core. */
const h = vi.hoisted(() => ({
  db: null as MockDb | null,
  flag: 'false',
  imgAllowed: true,
  sheetReq: null as { likenessPhoto?: unknown } | null,
  photoBytes: null as Buffer | null,
  removed: [] as string[][],
  uploaded: [] as string[],
}));

const THREE_VIEWS = {
  value: {
    images: [
      { view: 'turnaround', base64: 'aaa', mime: 'image/png' },
      { view: 'face_closeup', base64: 'bbb', mime: 'image/png' },
      { view: 'expression_sheet', base64: 'ccc', mime: 'image/png' },
    ],
    palette: ['warm'],
    clothingTokens: ['tee'],
    negativeConstraints: ['no text'],
  },
  usage: { model: 'gemini-image', images: 3 },
};

vi.mock('@/server/config/env', () => ({ loadEnv: () => ({ NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED: h.flag }) }));
vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('../lib/audit', () => ({ audit: async () => {} }));
vi.mock('../providers/index', () => ({
  resolveModelStamp: () => ({ modelTier: 'cost', textModel: 't', imageModel: 'i', promptVersion: 'v' }),
  getProviders: () => ({
    image: { generateCharacterSheet: async (req: { likenessPhoto?: unknown }) => { h.sheetReq = req; return THREE_VIEWS; } },
    moderator: { moderateImage: async () => ({ allowed: h.imgAllowed, reasons: h.imgAllowed ? [] : ['unsafe'] }) },
  }),
}));
vi.mock('../lib/storage', () => ({
  downloadAsset: async () => Buffer.from('cached-image-bytes'),
  uploadAsset: async (key: string) => { h.uploaded.push(key); },
}));
vi.mock('../lib/photo-intake', () => ({
  getPhoto: async () => h.photoBytes,
  removePhotos: async (keys: string[]) => { h.removed.push(keys); },
  assertPhotoEgressAllowed: () => {},
}));

import { resolveCharacterSheet, type BookContext } from './helpers';

const ctx: BookContext = {
  bookId: 'book-1', parentId: 'p1', heroId: 'hero-1', nickname: 'Aarav', ageBand: '5-6',
  avatar: { skinTone: 'medium', hair: 'short' }, interests: [], goal: 'reading_confidence',
  occasionPack: null, customTheme: null, readingLevel: 'early', purchasedTier: null,
  revisionInstruction: null, textModel: 't', imageModel: 'i',
};

describe('resolveCharacterSheet (engine)', () => {
  beforeEach(() => {
    h.flag = 'false'; h.imgAllowed = true; h.sheetReq = null; h.photoBytes = null; h.removed = []; h.uploaded = [];
  });

  it('reuses the cached reference pack without regenerating', async () => {
    h.db = makeSupabase({
      tables: {
        character_sheets: { data: { reference_pack: { images: [{ view: 'turnaround', storageKey: 'heroes/hero-1/sheet/turnaround.png', mime: 'image/png' }], palette: ['warm'], clothingTokens: ['tee'], negativeConstraints: ['no text'] } } },
      },
    });
    const pack = await resolveCharacterSheet(ctx);
    expect(pack.images[0].base64).toBe(Buffer.from('cached-image-bytes').toString('base64'));
    expect(h.sheetReq).toBeNull(); // never called the generator
    expect(h.uploaded).toHaveLength(0);
  });

  it('generates, moderates every view, and stores an attribute-sourced sheet on cache miss', async () => {
    h.db = makeSupabase({ tables: { character_sheets: (op) => (op === 'select' ? { data: null } : { data: null }) } });
    const pack = await resolveCharacterSheet(ctx);
    expect(pack.images).toHaveLength(3);
    expect(h.uploaded).toHaveLength(3); // one per view
    expect(findOp(h.db, 'character_sheets', 'insert')?.values).toMatchObject({ hero_id: 'hero-1', source: 'attributes', consent_id: null });
  });

  it('fails CLOSED when a generated view is blocked — marks failed, stores nothing', async () => {
    h.imgAllowed = false;
    h.db = makeSupabase({ tables: { character_sheets: { data: null }, books: { data: null }, book_revision_requests: { data: null } } });
    await expect(resolveCharacterSheet(ctx)).rejects.toThrow();
    expect(findOp(h.db, 'books', 'update')?.values).toMatchObject({ status: 'failed' });
    expect(findOp(h.db, 'character_sheets', 'insert')).toBeUndefined();
    expect(h.uploaded).toHaveLength(0);
  });

  it('with the flag ON + a consented photo: seeds from it once, then consumes+deletes it', async () => {
    h.flag = 'true';
    h.photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    h.db = makeSupabase({
      tables: {
        character_sheets: (op) => (op === 'select' ? { data: null } : { data: null }),
        photo_uploads: (op) => (op === 'select' ? { data: { id: 'pu1', storage_key: 'p1/pu1.jpg', consent_id: 'c1' } } : { data: null }),
        consent_records: { data: { scope: 'photo_likeness', withdrawn_at: null } },
        books: { data: null },
      },
    });
    const pack = await resolveCharacterSheet(ctx);
    expect(pack.images).toHaveLength(3);
    expect(h.sheetReq?.likenessPhoto).toBeTruthy(); // photo was passed to the generator...
    expect(h.removed).toContainEqual(['p1/pu1.jpg']); // ...and then deleted
    expect(findOp(h.db, 'photo_uploads', 'update')?.values).toMatchObject({ status: 'consumed' });
    expect(findOp(h.db, 'character_sheets', 'insert')?.values).toMatchObject({ source: 'photo', consent_id: 'c1' });
  });
});
